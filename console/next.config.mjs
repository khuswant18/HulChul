import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export default {
  turbopack: { root: path.join(here, "..") },
  devIndicators: false,
  agentRules: false,
};
