import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ComiteShell } from "@/components/agriplan/ComiteShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReasonDialog } from "@/components/agriplan/ReasonDialog";
import { toast } from "sonner";
import { formatError } from "@/lib/format-error";

export const Route = createFileRoute("/_authenticated/app/comite/bee-one")({
  ssr: false,
  component: () => <ComiteShell><View /></ComiteShell>,
});

function View() {
  const qc = useQueryClient();
  const rows = useQuery({
    queryKey: ["bee_one_ingestions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bee_one_ingestions").select("*").order("recu_le", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const [dialog, setDialog] = useState<{ id: string; decision: "acceptee" | "ecartee" | "signalee" } | null>(null);

  async function decide(motif: string) {
    if (!dialog) return;
    try {
      const { error } = await supabase.rpc("bee_one_examine", { p_id: dialog.id, p_decision: dialog.decision, p_motif: motif });
      if (error) throw error;
      toast.success("Décision enregistrée.");
      qc.invalidateQueries({ queryKey: ["bee_one_ingestions"] });
    } catch (e) { toast.error(formatError(e)); }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>File d'ingestion Bee One ({rows.data?.length ?? 0})</CardTitle>
          <CardDescription>Données agrégées et anonymisées. Les lots sous le seuil k-anonymat sont bloqués automatiquement.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-muted/50 text-xs uppercase font-mono tracking-wider">
              <tr>
                <th className="p-2 text-start">Reçu</th>
                <th className="p-2 text-start">Clé · Profil / Zone</th>
                <th className="p-2 text-start">Valeur</th>
                <th className="p-2 text-end">N</th>
                <th className="p-2 text-end">Seuil</th>
                <th className="p-2 text-start">Statut</th>
                <th className="p-2 text-end">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(rows.data ?? []).map((r: any) => (
                <tr key={r.id} className={r.statut === "bloquee_k" ? "opacity-60 bg-destructive/5" : ""}>
                  <td className="p-2 text-xs text-muted-foreground">{new Date(r.recu_le).toLocaleDateString()}</td>
                  <td className="p-2 font-mono text-xs">{r.cle_norme} · {r.profil_code ?? "—"} / {r.zone_code ?? "—"}</td>
                  <td className="p-2 text-xs"><code className="bg-muted px-1 rounded">{JSON.stringify(r.valeur_agrege)}</code></td>
                  <td className="p-2 text-end tabular-nums">{r.n_echantillon}</td>
                  <td className="p-2 text-end tabular-nums text-muted-foreground">{r.seuil_k_anonymat}</td>
                  <td className="p-2 text-xs font-mono">{r.statut}</td>
                  <td className="p-2 text-end space-x-1">
                    {r.statut === "a_examiner" && (
                      <>
                        <Button size="sm" onClick={() => setDialog({ id: r.id, decision: "acceptee" })}>Accepter</Button>
                        <Button size="sm" variant="outline" onClick={() => setDialog({ id: r.id, decision: "ecartee" })}>Écarter</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDialog({ id: r.id, decision: "signalee" })}>Signaler</Button>
                      </>
                    )}
                    {r.statut === "bloquee_k" && <span className="text-xs text-destructive">Sous seuil — bloqué</span>}
                  </td>
                </tr>
              ))}
              {(rows.data ?? []).length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">Aucune ingestion.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <ReasonDialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}
        title={dialog ? `Décision : ${dialog.decision}` : ""}
        minLen={5} onConfirm={decide} confirmLabel="Confirmer" />
    </>
  );
}
