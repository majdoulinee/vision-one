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
import { ShieldAlert, ShieldCheck } from "lucide-react";

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
  const lots = useQuery({
    queryKey: ["comite_active_lots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ref_lots").select("id, version_cible, statut").neq("statut", "publie");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [dialog, setDialog] = useState<{ id: string; decision: "acceptee" | "ecartee" | "signalee" } | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);

  async function decide(motif: string) {
    if (!dialog) return;
    try {
      const { error } = await supabase.rpc("bee_one_examine", { p_id: dialog.id, p_decision: dialog.decision, p_motif: motif });
      if (error) throw error;
      toast.success("Décision enregistrée.");
      qc.invalidateQueries({ queryKey: ["bee_one_ingestions"] });
    } catch (e) { toast.error(formatError(e)); }
  }

  async function acceptToProposition(row: any) {
    const activeLot = (lots.data ?? [])[0];
    if (!activeLot) return toast.error("Aucun lot ouvert. Créez d'abord un lot dans « Propositions ».");
    setAccepting(row.id);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("ref_propositions").insert({
        lot_id: activeLot.id,
        profil_code: row.profil_code, zone_code: row.zone_code,
        cle_norme: row.cle_norme,
        nouvelle_valeur: row.valeur_agrege,
        provenance: "bee_one",
        bee_one_n: row.n_echantillon,
        bee_one_periode: row.periode_couverte ?? null,
        justification: `Ingestion Bee One acceptée (N=${row.n_echantillon}, seuil k=${row.seuil_k_anonymat}).`,
        auteur: u.user?.id,
      });
      if (insErr) throw insErr;
      const { error } = await supabase.rpc("bee_one_examine", { p_id: row.id, p_decision: "acceptee", p_motif: `Acceptée et convertie en proposition brouillon (lot v${activeLot.version_cible}).` });
      if (error) throw error;
      toast.success("Ingestion acceptée → proposition brouillon créée.");
      qc.invalidateQueries();
    } catch (e) { toast.error(formatError(e)); }
    finally { setAccepting(null); }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>File d'ingestion Bee One ({rows.data?.length ?? 0})</CardTitle>
          <CardDescription>
            Pipeline automatisé — jamais de ressaisie manuelle. Les lots sous le seuil k-anonymat sont bloqués automatiquement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {(rows.data ?? []).map((r: any) => {
              const blocked = r.statut === "bloquee_k" || r.n_echantillon < r.seuil_k_anonymat;
              const ratio = Math.min(1, r.n_echantillon / Math.max(r.seuil_k_anonymat, 1));
              return (
                <div key={r.id} className="relative rounded-md border p-4 space-y-3" style={blocked ? { borderColor: "#C0552F", background: "rgba(192,85,47,0.05)" } : undefined}>
                  {blocked && (
                    <div className="absolute top-0 right-0 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-bl" style={{ background: "#C0552F", color: "#F3EFE3" }}>
                      Bloqué · sous seuil k
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-xs uppercase tracking-wider">{r.cle_norme}</div>
                      <div className="text-xs text-muted-foreground">{r.profil_code ?? "—"} / {r.zone_code ?? "—"} · reçu {new Date(r.recu_le).toLocaleDateString()}</div>
                      {r.periode_couverte && <div className="text-[10px] text-muted-foreground italic">Période : {r.periode_couverte}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold tabular-nums">N = {r.n_echantillon}</div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">seuil k = {r.seuil_k_anonymat}</div>
                    </div>
                  </div>
                  {/* Jauge k-anonymat */}
                  <div className="space-y-1">
                    <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
                      <div className="absolute inset-y-0 left-0" style={{ width: `${ratio * 100}%`, background: blocked ? "#C0552F" : "#4E8C5F" }} />
                      <div className="absolute inset-y-0" style={{ left: "100%", transform: "translateX(-1px)", width: 2, background: "#12211A" }} />
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider" style={{ color: blocked ? "#C0552F" : "#4E8C5F" }}>
                      {blocked ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                      {blocked ? "publication interdite — données non exploitables en l'état" : "conforme au seuil k-anonymat"}
                    </div>
                  </div>
                  <div className="text-xs">
                    Valeur agrégée : <code className="bg-muted px-1 rounded text-[10px]">{JSON.stringify(r.valeur_agrege)}</code>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                    <span className="text-[10px] font-mono uppercase tracking-wider rounded border px-1.5 py-0.5">{r.statut}</span>
                    {r.statut === "a_examiner" && (
                      <div className="flex gap-1">
                        <Button size="sm" disabled={blocked || !!accepting} onClick={() => acceptToProposition(r)}>
                          {accepting === r.id ? "…" : "Accepter → brouillon"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDialog({ id: r.id, decision: "ecartee" })}>Écarter</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDialog({ id: r.id, decision: "signalee" })}>Signaler</Button>
                      </div>
                    )}
                    {r.statut === "bloquee_k" && (
                      <Button size="sm" variant="outline" onClick={() => setDialog({ id: r.id, decision: "ecartee" })}>Écarter (motif)</Button>
                    )}
                  </div>
                  {r.motif && <div className="text-xs italic text-muted-foreground">Motif : {r.motif}</div>}
                </div>
              );
            })}
            {(rows.data ?? []).length === 0 && (
              <div className="col-span-full p-8 text-center text-sm text-muted-foreground">Aucune ingestion.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <ReasonDialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}
        title={dialog ? `Décision : ${dialog.decision}` : ""}
        minLen={5} onConfirm={decide} confirmLabel="Confirmer" />
    </>
  );
}
