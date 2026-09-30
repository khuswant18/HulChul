import { NewRunForm } from "@/components/NewRunForm";
import { RunsList } from "@/components/RunsList";
import { SandboxPanel } from "@/components/SandboxPanel";

export default function Home() {
  return (
    <div className="home">
      <NewRunForm />
      <div>
        <RunsList />
        <SandboxPanel />
      </div>
    </div>
  );
}
