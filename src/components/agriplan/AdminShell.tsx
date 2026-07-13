import { Link, useLocation, Navigate } from "@tanstack/react-router";
import { usePlatformRole } from "@/hooks/use-platform-role";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Info } from "lucide-react";

const TABS: Array<{ to: string; label: string; badgeQ?: string }> = [
  { to: "/app/admin/organizations", label: "Organisations" },
  { to: "/app/admin/users", label: "Utilisateurs" },
  { to: "/app/admin/credits", label: "Crédits", badgeQ: "requests_pending" },
  { to: "/app/admin/plans", label: "Plans & tarifs" },
  { to: "/app/admin/consultants", label: "Consultants" },
  { to: "/app/admin/referentiel", label: "Référentiel", badgeQ: "propositions_pending" },
  { to: "/app/admin/audit", label: "Audit" },
];

function PendingBadge({ kind }: { kind: string }) {
  const q = useQuery({
    queryKey: ["admin_topbar_badge", kind],
    queryFn: async () => {
      if (kind === "requests_pending") {
        const { count } = await supabase
          .from("credit_requests").select("id", { count: "exact", head: true })
          .eq("statut", "en_attente");
        return count ?? 0;
      }
      if (kind === "propositions_pending") {
        const { count } = await supabase
          .from("ref_propositions").select("id", { count: "exact", head: true })
          .eq("statut", "validee_comite");
        return count ?? 0;
      }
      return 0;
    },
    refetchInterval: 60_000,
  });
  if (!q.data) return null;
  return <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground tabular-nums">{q.data}</span>;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { data: role, isLoading } = usePlatformRole();
  const loc = useLocation();
  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  if (role !== "admin") return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-4">
      {/* Topbar vert encre */}
      <div className="rounded-md border overflow-hidden" style={{ background: "#12211A", color: "#F3EFE3" }}>
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            <span>VISION ONE</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] bg-white/10 rounded px-2 py-0.5">Admin plateforme</span>
          </div>
          <nav className="flex flex-wrap items-center gap-1 ml-auto">
            {TABS.map((t) => {
              const active = loc.pathname.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to as any}
                  className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                    active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {t.label}
                  {t.badgeQ && <PendingBadge kind={t.badgeQ} />}
                </Link>
              );
            })}
          </nav>
        </div>
        {/* Mode banner ocre */}
        <div className="flex items-start gap-2 px-4 py-2 text-xs" style={{ background: "#D9A521", color: "#12211A" }}>
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div><strong>MODE : OCTROI MANUEL</strong> — encaissement hors plateforme (virement / facture). Aucune donnée bancaire n'est traitée par Vision One.</div>
        </div>
      </div>
      {children}
    </div>
  );
}