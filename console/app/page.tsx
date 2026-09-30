import { NewRunForm } from "@/components/NewRunForm";
import { RunsList } from "@/components/RunsList";
import { SandboxPanel } from "@/components/SandboxPanel";

export default function Home() {
  return (
    <>
      <div className="mesh" aria-hidden="true" />
      <section className="hero">
        <h1>Tell it the job you want. It applies, logs it and shows the proof.</h1>
        <p>A browser operator for internship hunting. It asks before it spends money or signs anything.</p>
      </section>
      <div className="home">
        <div className="card raised">
          <NewRunForm />
        </div>
        <div className="stack">
          <div className="card">
            <RunsList />
          </div>
          <div className="card cream">
            <SandboxPanel />
          </div>
        </div>
      </div>
    </>
  );
}
