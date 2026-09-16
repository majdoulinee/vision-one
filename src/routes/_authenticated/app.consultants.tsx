import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { fmtCountry } from "@/lib/format";
import { EmptyState } from "@/components/agriplan/EmptyState";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/consultants")({
  ssr: false,
  component: ConsultantsSpace,
});

function ConsultantsSpace() {
  const { t } = useTranslation();
  const { current, switchOrg, orgs, isLoading } = useCurrentOrg();
  const qc = useQueryClient();
  const links = useConsultantLinksForConsultant();
  const [revokeId, setRevokeId] = useState<string | null>(null);

  if (isLoading || !current) return <div className="text-muted-foreground">{t("common.loading")}</div>;
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
      toast.success(t("consultants.revocationSent"));
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
        <h1 className="text-3xl font-bold tracking-tight">{t("consultants.title")}</h1>
        <p className="text-muted-foreground">
          {t("consultants.subtitle")} <strong>{current.org.name}</strong>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("consultants.activeCount", { count: active.length })}</CardTitle>
          <CardDescription>
            {t("consultants.activeDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <ComiteTable
            minWidth={900}
            columns={[
              { key: "client", header: t("consultants.colClient") },
              { key: "role", header: t("settings.role") },
              { key: "credits", header: t("consultants.colCredits") },
              { key: "date", header: t("consultants.colSince") },
              { key: "act", header: t("common.actions"), align: "end" },
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
                      {l.client_org?.type} · {fmtCountry(l.client_org?.country)}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="mono-eyebrow">{l.role}</Badge></TableCell>
                  <TableCell className="text-xs">{t("consultants.sourceLabel", { source: l.credits_source })}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(l.accorde_le).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-end space-x-1">
                    {canSwitch ? (
                      <Button size="sm" variant="outline" onClick={() => switchOrg(clientId)}>
                        {t("consultants.openAsClient")}
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        {t("consultants.notMember")}
                      </span>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setRevokeId(l.id)}>
                      {t("consultants.requestRevocation")}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {active.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    icon={Users}
                    title={t("consultants.emptyTitle")}
                    description={t("consultants.emptyDesc")}
                  />
                </TableCell>
              </TableRow>
            )}
          </ComiteTable>
        </CardContent>
      </Card>

      {other.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("consultants.historyCount", { count: other.length })}</CardTitle>
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
        title={t("consultants.revocationDialogTitle")}
        description={t("consultants.revocationDialogDesc")}
        minLen={5}
        destructive
        confirmLabel={t("consultants.requestRevocation")}
        onConfirm={requestRevocation}
      />
    </div>
  );
}