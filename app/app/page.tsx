import { employees } from "@/lib/employees";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <p className="text-muted-foreground text-xs uppercase tracking-widest">
          Fiverr for OpenClaw
        </p>
        <h1 className="text-4xl font-bold tracking-tight">
          Hire an AI employee in two clicks.
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base">
          Specialized, containerized teammates that show up in your tools and
          start working. No setup, no self-hosting, no prompt engineering.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Hackathon starter talent directory
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {employees.map((e) => (
            <li
              key={e.id}
              className="border rounded-lg p-5 space-y-2 bg-card/40"
            >
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {e.department}
              </div>
              <div className="text-lg font-semibold">{e.displayName}</div>
              <div className="text-sm text-muted-foreground">{e.tagline}</div>
              <div className="text-xs text-muted-foreground pt-2">
                Required tools: {e.requiredTools.join(", ")}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="border border-dashed rounded-lg p-6 text-sm text-muted-foreground space-y-2">
        <div className="font-semibold text-foreground">
          Frontend handoff in progress
        </div>
        <div>
          This page is a placeholder. The hire flow build brief lives at{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded">app/HANDOFF.md</code>.
          Read that first, then build out <code>/directory</code>,{" "}
          <code>/directory/[role]</code>, and <code>/hire/[role]</code>.
        </div>
      </section>
    </div>
  );
}
