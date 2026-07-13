import { Link, useLocation, Navigate } from "@tanstack/react-router";
import { usePlatformRole } from "@/hooks/use-platform-role";
import { Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
      <div className="rounded-sm border border-ink bg-ink text-parch overflow-hidden hard-shadow-ink">
        <div className="flex flex-wrap items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2 font-serif text-base">
            <Landmark className="h-4 w-4 text-ochre" />
            <span className="tracking-tight">Vision One</span>
            <Badge variant="ochre">Comité d'experts</Badge>
          </div>
          <nav className="flex flex-wrap items-center gap-1 ml-auto">
            {TABS.map((t) => {
              const active = loc.pathname.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to as any}
                  className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                    active
                      ? "bg-parch/15 text-parch"
                      : "text-parch/70 hover:bg-parch/10 hover:text-parch"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-t border-parch/10 bg-parch/5">
          {PIPELINE.map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              <Badge variant="ochre-soft">{s}</Badge>
              {i < PIPELINE.length - 1 && <span className="text-parch/40">→</span>}
            </span>
          ))}
          <span className="ml-auto font-serif italic text-parch/70 text-[12px]">
            Double validation : le comité valide le fond, l'admin approuve la gouvernance. Personne ne publie seul.
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
