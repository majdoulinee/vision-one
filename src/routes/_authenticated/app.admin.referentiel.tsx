import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/agriplan/AdminShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReasonDialog } from "@/components/agriplan/ReasonDialog";
import { toast } from "sonner";
import { formatError } from "@/lib/format-error";
import { Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin/referentiel")({
  ssr: false,
  component: () => <AdminShell><AdminRefView /></AdminShell>,
});

function AdminRefView() {
  const qc = useQueryClient();
  const props = useQuery({
    queryKey: ["admin_ref_propositions_pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ref_propositions")
        .select("*, ref_lots(version_cible)")
        .eq("statut", "validee_comite")
        .order("valide_comite_le", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const lots = useQuery({
    queryKey: ["admin_ref_lots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ref_lots").select("*").order("cree_le", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [returnId, setReturnId] = useState<string | null>(null);

  async function approve(id: string) {
    try {
      const { error } = await supabase.rpc("admin_approve_proposition", { p_id: id });
      if (error) throw error;
      toast.success("Approuvée.");
      qc.invalidateQueries();
    } catch (e) { toast.error(formatError(e)); }
  }
  async function doReturn(motif: string) {
    if (!returnId) return;
    try {
      const { error } = await supabase.rpc("admin_return_proposition", { p_id: returnId, p_motif: motif });
      if (error) throw error;
      toast.success("Renvoyée au comité.");
      qc.invalidateQueries();
    } catch (e) { toast.error(formatError(e)); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded border border-accent/60 bg-accent/15 p-3 text-sm flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div><strong>L'admin approuve la gouvernance, il ne modifie pas le fond.</strong> Toute correction repasse par le comité.</div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Propositions à approuver ({props.data?.length ?? 0})</CardTitle>
          <CardDescription>Statut « validée comité » — aucun champ éditable.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {(props.data ?? []).map((p: any) => (
              <div key={p.id} className="p-3 flex flex-wrap items-start gap-3 justify-between">
                <div className="text-sm space-y-1">
                  <div className="font-mono text-xs uppercase tracking-wider">{p.cle_norme} · {p.profil_code ?? "—"} / {p.zone_code ?? "—"}</div>
                  <div className="text-xs">Version cible : <strong>{p.ref_lots?.version_cible}</strong> · Provenance : {p.provenance}{p.bee_one_n ? ` (N=${p.bee_one_n})` : ""}</div>
                  <div className="text-xs flex flex-wrap gap-3">
                    <span>Ancienne : <code className="bg-muted px-1 rounded">{JSON.stringify(p.ancienne_valeur)}</code></span>
                    <span>Nouvelle : <code className="bg-primary/10 px-1 rounded">{JSON.stringify(p.nouvelle_valeur)}</code></span>
                  </div>
                  <div className="text-xs text-muted-foreground italic">« {p.justification} »</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approve(p.id)}>Approuver</Button>
                  <Button size="sm" variant="outline" onClick={() => setReturnId(p.id)}>Renvoyer…</Button>
                </div>
              </div>
            ))}
            {(props.data ?? []).length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">Aucune proposition en attente d'approbation.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lots en préparation</CardTitle>
          <CardDescription>Un lot correspond à une future version publiée du référentiel.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase font-mono tracking-wider">
              <tr>
                <th className="p-2 text-start">Version cible</th>
                <th className="p-2 text-start">Statut</th>
                <th className="p-2 text-start">Créé le</th>
                <th className="p-2 text-start">Publié le</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(lots.data ?? []).map((l: any) => (
                <tr key={l.id}>
                  <td className="p-2 font-mono text-xs">{l.version_cible}</td>
                  <td className="p-2 text-xs">{l.statut}</td>
                  <td className="p-2 text-xs text-muted-foreground">{new Date(l.cree_le).toLocaleDateString()}</td>
                  <td className="p-2 text-xs text-muted-foreground">{l.publie_le ? new Date(l.publie_le).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {(lots.data ?? []).length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">Aucun lot pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <ReasonDialog open={!!returnId} onOpenChange={(v) => !v && setReturnId(null)}
        title="Renvoyer la proposition au comité" confirmLabel="Renvoyer" onConfirm={doReturn} />
    </div>
  );
}
