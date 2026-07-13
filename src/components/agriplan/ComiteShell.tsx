import { Link, useLocation, Navigate } from "@tanstack/react-router";
import { usePlatformRole } from "@/hooks/use-platform-role";
import { Landmark } from "lucide-react";

const TABS = [
  { to: "/app/comite/propositions", label: "Propositions" },
  { to: "/app/comite/bee-one", label: "Bee One" },
  { to: "/app/comite/publish", label: "Publication" },
];

export function ComiteShell({ children }: { children: React.ReactNode }) {
  const { data: role, isLoading } = usePlatformRole();
  const loc = useLocation();
  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  if (role !== "comite" && role !== "admin") return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-hidden" style={{ background: "#12211A", color: "#F3EFE3" }}>
        <div className="flex flex-wrap items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <Landmark className="h-4 w-4" />
            <span>VISION ONE</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] rounded px-2 py-0.5" style={{ background: "#D9A521", color: "#12211A" }}>Comité d'experts</span>
          </div>
          <nav className="flex flex-wrap items-center gap-1 ml-auto">
            {TABS.map((t) => {
              const active = loc.pathname.startsWith(t.to);
              return (
                <Link key={t.to} to={t.to as any} className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      {children}
    </div>
  );
}
