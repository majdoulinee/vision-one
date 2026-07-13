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
import { Lock } from "lucide-react";

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
      const { data, error } = await supabase.from("ref_propositions").select("lot_id, statut, profil_code");
      if (error) throw error;
      const by: Record<string, { statuts: Record<string, number>; profils: Set<string> }> = {};
      (data ?? []).forEach((p: any) => {
        if (!by[p.lot_id]) by[p.lot_id] = { statuts: {}, profils: new Set() };
        by[p.lot_id].statuts[p.statut] = (by[p.lot_id].statuts[p.statut] ?? 0) + 1;
        if (p.profil_code) by[p.lot_id].profils.add(p.profil_code);
      });
      return by;
    },
  });

  const [publish, setPublish] = useState<{ id: string; version: string; nbNormes: number; nbProfils: number } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [impact, setImpact] = useState<{ projets: number } | null>(null);

  async function openPublish(lot: any) {
    const s = stats.data?.[lot.id];
    const nbNormes = s ? (Object.values(s.statuts) as number[]).reduce((a, b) => a + b, 0) : 0;
    const profils = s ? Array.from(s.profils) : [];
    setPublish({ id: lot.id, version: lot.version_cible, nbNormes, nbProfils: profils.length });
    setNote("");
    setImpact(null);
    if (profils.length > 0) {
      const { count } = await supabase.from("projects")
        .select("id", { count: "exact", head: true })
        .in("profile_code", profils as string[]);
      setImpact({ projets: count ?? 0 });
    } else {
      setImpact({ projets: 0 });
    }
  }

  async function doPublish() {
    if (!publish) return;
    if (note.trim().length < 10) return toast.error("Note ≥ 10 car.");
    setBusy(true);
    try {
      const { error } = await supabase.rpc("comite_publish_lot", { p_lot_id: publish.id, p_note: note });
      if (error) throw error;
      // Notifie les clients touchés (RPC sépare la logique côté serveur)
      const { data: nbNotified, error: nerr } = await supabase.rpc("comite_notify_ref_publication", { p_lot_id: publish.id });
      if (nerr) console.warn("notif publication:", nerr.message);
      toast.success(`Version ${publish.version} publiée.`);
      if (typeof nbNotified === "number" && nbNotified > 0) {
        toast.message(`${nbNotified} destinataire(s) notifié(s) de la nouvelle version.`);
      }
      setPublish(null); setNote("");
      qc.invalidateQueries();
    } catch (e) { toast.error(formatError(e)); }
    finally { setBusy(false); }
  }

  // Lot courant = premier lot non publié (pour la barre sticky)
  const currentLot = (lots.data ?? []).find((l: any) => l.statut !== "publie");
  const currentStats = currentLot ? stats.data?.[currentLot.id] : null;
  const cs = currentStats?.statuts ?? {};
  const total = (Object.values(cs) as number[]).reduce((a, b) => a + b, 0);
  const approved = cs["approuvee_admin"] ?? 0;
  const canPublishCurrent = total > 0 && approved === total;

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
                const s = stats.data?.[l.id]?.statuts ?? {};
                const tot = (Object.values(s) as number[]).reduce((a, b) => a + b, 0);
                const app = s["approuvee_admin"] ?? 0;
                const canPublish = tot > 0 && app === tot && l.statut !== "publie";
                return (
                  <tr key={l.id}>
                    <td className="p-2 font-mono text-xs font-semibold">v{l.version_cible}</td>
                    <td className="p-2 text-xs">{l.statut}</td>
                    <td className="p-2 text-xs">
                      <span className="tabular-nums">{app}/{tot}</span> approuvées
                      {tot > 0 && Object.entries(s).map(([k, n]) => k !== "approuvee_admin" && <span key={k} className="ml-2 text-muted-foreground">· {k}: {n as number}</span>)}
                    </td>
                    <td className="p-2 text-end">
                      <Button size="sm" disabled={!canPublish} onClick={() => openPublish(l)}>Publier</Button>
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

      {/* Barre sticky de publication */}
      {currentLot && (
        <div className="sticky bottom-0 -mx-4 sm:mx-0 mt-4 rounded-md border shadow-lg" style={{ background: "#12211A", color: "#F3EFE3" }}>
          <div className="flex flex-wrap items-center gap-4 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
              <Lock className="h-3.5 w-3.5" style={{ color: "#D9A521" }} />
              Lot v{currentLot.version_cible}
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <span>Brouillon: <b className="tabular-nums">{cs["brouillon"] ?? 0}</b></span>
              <span>Soumise: <b className="tabular-nums">{cs["soumise"] ?? 0}</b></span>
              <span>Validée: <b className="tabular-nums">{cs["validee_comite"] ?? 0}</b></span>
              <span style={{ color: "#4E8C5F" }}>Approuvée: <b className="tabular-nums">{approved}</b></span>
              <span style={{ color: "#C0552F" }}>Renvoyée: <b className="tabular-nums">{cs["renvoyee_comite"] ?? 0}</b></span>
            </div>
            <span className="text-[11px] italic opacity-80 hidden md:inline">
              {canPublishCurrent
                ? "Toutes les propositions sont approuvées — publication possible."
                : "Publication possible uniquement quand toutes les propositions du lot sont approuvées par l'admin."}
            </span>
            <Button
              size="sm"
              className="ml-auto"
              style={{ background: canPublishCurrent ? "#D9A521" : "rgba(255,255,255,0.15)", color: "#12211A" }}
              disabled={!canPublishCurrent}
              onClick={() => openPublish(currentLot)}
            >
              Publier v{currentLot.version_cible}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!publish} onOpenChange={(v) => !v && setPublish(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Publier v{publish?.version} — irréversible</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded border p-2">
              <div className="text-2xl font-semibold tabular-nums">{publish?.nbNormes ?? 0}</div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">Normes modifiées</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-2xl font-semibold tabular-nums">{publish?.nbProfils ?? 0}</div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">Profils touchés</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-2xl font-semibold tabular-nums">{impact?.projets ?? "…"}</div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">Projets clients</div>
            </div>
          </div>
          <div className="rounded border p-3 text-xs" style={{ background: "rgba(217,165,33,0.15)", borderColor: "#D9A521" }}>
            <strong>Cette action est irréversible.</strong> La version sera figée à jamais. Toute correction exigera une nouvelle version. Les documents déjà générés restent vérifiables sur leur version d'origine.
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Note de version (visible par les clients, min. 10 car.)</label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. Révision des besoins hydriques Avocat Zone Souss suite à campagne 2025-2026." />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublish(null)}>Annuler</Button>
            <Button onClick={doPublish} disabled={busy || note.trim().length < 10} style={{ background: "#C0552F", color: "#F3EFE3" }}>
              Publier et figer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
