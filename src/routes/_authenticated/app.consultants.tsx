import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useConsultantLinksForConsultant } from "@/hooks/use-consultant-links";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ComiteTable } from "@/components/agriplan/ComiteTable";
import { TableCell, TableRow } from "@/components/ui/table";
import { ReasonDialog } from "@/components/agriplan/ReasonDialog";
import { Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { formatError } from "@/lib/format-error";

export const Route = createFileRoute("/_authenticated/app/consultants")({
  ssr: false,
  component: ConsultantsSpace,
});

function ConsultantsSpace() {
  const { current, switchOrg, orgs, isLoading } = useCurrentOrg();
  const qc = useQueryClient();
  const links = useConsultantLinksForConsultant();
  const [revokeId, setRevokeId] = useState<string | null>(null);

  if (isLoading || !current) return <div className="text-muted-foreground">Chargement…</div>;
  if (current.org.type !== "consultant") {
    return <Navigate to="/dashboard" />;
  }

  async function requestRevocation(motif: string) {
    if (!revokeId) return;
    try {
      const { error } = await supabase.rpc("client_request_consultant_revocation", {
        p_link_id: revokeId, p_motif: motif,
      });
      if (error) throw error;
      toast.success("Demande envoyée à l'administrateur plateforme.");
      qc.invalidateQueries({ queryKey: ["consultant_links_consultant", current!.org_id] });
    } catch (e) {
      toast.error(formatError(e));
    }
  }

  const rows = (links.data ?? []) as any[];
  const active = rows.filter((l) => l.statut === "actif");
  const other = rows.filter((l) => l.statut !== "actif");

  const memberOrgIds = new Set(orgs.map((o) => o.org_id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mes clients</h1>
        <p className="text-muted-foreground">
          Organisations clientes rattachées à votre cabinet <strong>{current.org.name}</strong>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rattachements actifs ({active.length})</CardTitle>
          <CardDescription>
            Utilisez « Ouvrir » pour basculer sur l'organisation cliente (si vous en êtes également membre).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <ComiteTable
            minWidth={900}
            columns={[
              { key: "client", header: "Client" },
              { key: "role", header: "Rôle" },
              { key: "credits", header: "Crédits" },
              { key: "date", header: "Depuis" },
              { key: "act", header: "Actions", align: "end" },
            ]}
          >
            {active.map((l) => {
              const clientId = l.client_org?.id ?? l.client_org_id;
              const canSwitch = memberOrgIds.has(clientId);
              return (
                <TableRow key={l.id}>
                  <TableCell>
                    <div className="font-medium">{l.client_org?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.client_org?.type} · {l.client_org?.country ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="mono-eyebrow">{l.role}</Badge></TableCell>
                  <TableCell className="text-xs">source : {l.credits_source}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(l.accorde_le).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-end space-x-1">
                    {canSwitch ? (
                      <Button size="sm" variant="outline" onClick={() => switchOrg(clientId)}>
                        Ouvrir en mode client
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        Non-membre du client
                      </span>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setRevokeId(l.id)}>
                      Demander la révocation
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {active.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                  Aucun client rattaché pour le moment.
                </TableCell>
              </TableRow>
            )}
          </ComiteTable>
        </CardContent>
      </Card>

      {other.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique ({other.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {other.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <div className="font-medium">{l.client_org?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.role} · {new Date(l.accorde_le).toLocaleDateString()}
                  </div>
                </div>
                <Badge variant="destructive" className="mono-eyebrow">{l.statut}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ReasonDialog
        open={!!revokeId}
        onOpenChange={(v) => !v && setRevokeId(null)}
        title="Demander la fin du rattachement"
        description="Un administrateur plateforme traitera votre demande. Motif obligatoire (journal d'audit)."
        minLen={5}
        destructive
        confirmLabel="Envoyer la demande"
        onConfirm={requestRevocation}
      />
    </div>
  );
}