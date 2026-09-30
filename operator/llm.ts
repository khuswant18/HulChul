import Groq, { APIConnectionError, APIError, AuthenticationError, PermissionDeniedError, RateLimitError } from "groq-sdk";
import { z } from "zod";

export type LlmNote = (message: string) => void;

export class Llm {
  readonly mode: "groq" | "rules";
  readonly model: string;
  calls = 0;
  fallbacks = 0;
  private client: Groq | null = null;

  constructor(private note: LlmNote = () => {}) {
    const setting = (process.env.OPERATOR_LLM ?? "auto").toLowerCase();
    const hasKey = Boolean(process.env.GROQ_API_KEY);
    this.mode = (setting === "groq" || setting === "auto") && hasKey ? "groq" : "rules";

    this.model = process.env.OPERATOR_MODEL || "openai/gpt-oss-120b";
    if (this.mode === "groq") this.client = new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 2, timeout: 60_000 });
  }

  get enabled() {
    return this.client !== null;
  }

  async json<T extends z.ZodType>(
    schema: T,
    task: { system: string; prompt: string; purpose: string },
  ): Promise<z.infer<T> | null> {
    if (!this.client) return null;
    this.calls += 1;

    const { $schema: _unused, ...jsonSchema } = z.toJSONSchema(schema) as Record<string, unknown>;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_completion_tokens: 4000,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: `${task.system}\nReply only with JSON that matches the given schema.` },
          { role: "user", content: task.prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "result", strict: true, schema: jsonSchema },
        },
      });

      const choice = response.choices[0];
      if (!choice || choice.finish_reason === "length" || !choice.message.content) {
        return this.fail(`${task.purpose}: model output was incomplete, using rules instead`);
      }

      const parsed = schema.safeParse(JSON.parse(choice.message.content));
      if (!parsed.success) {
        return this.fail(`${task.purpose}: model output didn't match the expected shape, using rules instead`);
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) {
        this.client = null;
        return this.fail(`${task.purpose}: Groq API key rejected. Using rules for the rest of this run`);
      }
      if (error instanceof APIConnectionError) {
        return this.fail(`${task.purpose}: could not reach Groq, using rules instead`);
      }
      if (error instanceof RateLimitError) {
        return this.fail(`${task.purpose}: Groq rate limit hit, using rules instead`);
      }
      if (error instanceof APIError) {
        return this.fail(`${task.purpose}: Groq API error ${error.status ?? ""}, using rules instead`);
      }
      if (error instanceof SyntaxError) {
        return this.fail(`${task.purpose}: model returned invalid JSON, using rules instead`);
      }
      return this.fail(`${task.purpose}: ${(error as Error).message}, using rules instead`);
    }
  }

  private fail(message: string) {
    this.fallbacks += 1;
    this.note(message);
    return null;
  }
}
