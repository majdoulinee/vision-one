import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ComiteShell } from "@/components/agriplan/ComiteShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatError } from "@/lib/format-error";

export const Route = createFileRoute("/_authenticated/app/comite/publish")({
  ssr: false,
  component: () => <ComiteShell><View /></ComiteShell>,
});

function View() {
  const qc = useQueryClient();
  const lots = useQuery({
    queryKey: ["comite_publish_lots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ref_lots").select("*").order("cree_le", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const stats = useQuery({
    queryKey: ["comite_publish_stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ref_propositions").select("lot_id, statut");
      if (error) throw error;
      const by: Record<string, Record<string, number>> = {};
      (data ?? []).forEach((p: any) => {
        by[p.lot_id] = by[p.lot_id] || {};
        by[p.lot_id][p.statut] = (by[p.lot_id][p.statut] ?? 0) + 1;
      });
      return by;
    },
  });

  const [publish, setPublish] = useState<{ id: string; version: string } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function doPublish() {
    if (!publish) return;
    if (note.trim().length < 10) return toast.error("Note ≥ 10 car.");
    setBusy(true);
    try {
      const { error } = await supabase.rpc("comite_publish_lot", { p_lot_id: publish.id, p_note: note });
      if (error) throw error;
      toast.success(`Version ${publish.version} publiée.`);
      setPublish(null); setNote("");
      qc.invalidateQueries();
    } catch (e) { toast.error(formatError(e)); }
    finally { setBusy(false); }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Publication de versions</CardTitle>
          <CardDescription>Un lot ne peut être publié que si toutes ses propositions sont « approuvée admin ». Une version publiée est immuable.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-muted/50 text-xs uppercase font-mono tracking-wider">
              <tr>
                <th className="p-2 text-start">Version</th>
                <th className="p-2 text-start">Statut</th>
                <th className="p-2 text-start">Propositions</th>
                <th className="p-2 text-end">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(lots.data ?? []).map((l: any) => {
                const s = stats.data?.[l.id] ?? {};
                const total = (Object.values(s) as number[]).reduce((a, b) => a + b, 0);
                const approved = s["approuvee_admin"] ?? 0;
                const canPublish = total > 0 && approved === total && l.statut !== "publie";
                return (
                  <tr key={l.id}>
                    <td className="p-2 font-mono text-xs font-semibold">v{l.version_cible}</td>
                    <td className="p-2 text-xs">{l.statut}</td>
                    <td className="p-2 text-xs">
                      <span className="tabular-nums">{approved}/{total}</span> approuvées
                      {total > 0 && Object.entries(s).map(([k, n]) => k !== "approuvee_admin" && <span key={k} className="ml-2 text-muted-foreground">· {k}: {n as number}</span>)}
                    </td>
                    <td className="p-2 text-end">
                      <Button size="sm" disabled={!canPublish} onClick={() => setPublish({ id: l.id, version: l.version_cible })}>Publier</Button>
                    </td>
                  </tr>
                );
              })}
              {(lots.data ?? []).length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">Aucun lot.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!publish} onOpenChange={(v) => !v && setPublish(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Publier v{publish?.version} — irréversible</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Cette version deviendra immuable. Toute correction ultérieure passera par un nouveau lot.</p>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note de version (min. 10 car.)" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublish(null)}>Annuler</Button>
            <Button onClick={doPublish} disabled={busy || note.trim().length < 10}>Publier définitivement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
