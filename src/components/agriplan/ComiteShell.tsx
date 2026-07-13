import { Link, useLocation, Navigate } from "@tanstack/react-router";
import { usePlatformRole } from "@/hooks/use-platform-role";
import { Landmark } from "lucide-react";

const TABS = [
  { to: "/app/comite/propositions", label: "Propositions" },
  { to: "/app/comite/bee-one", label: "Bee One" },
  { to: "/app/comite/versions", label: "Versions publiées" },
  { to: "/app/comite/publish", label: "Publication" },
];

const PIPELINE = [
  "BROUILLON",
  "SOUMISE",
  "VALIDÉE COMITÉ",
  "APPROBATION ADMIN",
  "PUBLIÉE · IMMUABLE",
];

export function ComiteShell({ children }: { children: React.ReactNode }) {
  const { data: role, isPending, isFetching } = usePlatformRole();
  const loc = useLocation();
  if (isPending || isFetching || role === undefined) {
    return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  }
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
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-t border-white/10 text-[10px] font-mono uppercase tracking-[0.12em]" style={{ background: "rgba(255,255,255,0.03)" }}>
          {PIPELINE.map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded-sm" style={{ background: "rgba(217,165,33,0.15)", color: "#F3EFE3" }}>{s}</span>
              {i < PIPELINE.length - 1 && <span className="opacity-40">→</span>}
            </span>
          ))}
          <span className="ml-auto normal-case tracking-normal text-[11px] italic opacity-70">
            Double validation : le comité valide le fond, l'admin approuve la gouvernance. Personne ne publie seul.
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
