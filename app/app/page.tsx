import { employees } from "@/lib/employees";
import Link from "next/link";

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

      <section className="flex gap-3">
        <Link href="/agents" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          Open Agent Operations →
        </Link>
        <Link href="/test" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm text-muted-foreground hover:bg-accent transition-colors">
          Test Surface
        </Link>
      </section>
    </div>
  );
}
