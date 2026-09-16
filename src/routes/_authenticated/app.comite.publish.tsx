import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ComiteShell } from "@/components/agriplan/ComiteShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { ComiteTable, type ComiteColumn } from "@/components/agriplan/ComiteTable";
import { LotStatusBadge } from "@/components/agriplan/StatusBadge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatError } from "@/lib/format-error";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/comite/publish")({
  ssr: false,
  component: () => <ComiteShell><View /></ComiteShell>,
});

const PUBLISH_COLUMNS: ComiteColumn[] = [
  { key: "version", header: "Version", align: "start" },
  { key: "statut", header: "Statut", align: "start" },
  { key: "props", header: "Propositions", align: "start" },
  { key: "actions", header: "Actions", align: "end" },
];

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
          <ComiteTable minWidth={700} columns={PUBLISH_COLUMNS}>
              {(lots.data ?? []).map((l: any) => {
                const s = stats.data?.[l.id]?.statuts ?? {};
                const tot = (Object.values(s) as number[]).reduce((a, b) => a + b, 0);
                const app = s["approuvee_admin"] ?? 0;
                const canPublish = tot > 0 && app === tot && l.statut !== "publie";
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs font-semibold">v{l.version_cible}</TableCell>
                    <TableCell><LotStatusBadge statut={l.statut} /></TableCell>
                    <TableCell className="text-xs">
                      <span className="tabular-nums">{app}/{tot}</span> approuvées
                      {tot > 0 && Object.entries(s).map(([k, n]) => k !== "approuvee_admin" && <span key={k} className="ml-2 text-muted-foreground">· {k}: {n as number}</span>)}
                    </TableCell>
                    <TableCell className="text-end">
                      <Button size="sm" variant="ink" disabled={!canPublish} onClick={() => openPublish(l)}>Publier</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(lots.data ?? []).length === 0 && (
                <TableRow className="hover:bg-transparent"><TableCell colSpan={4} className="p-6 text-center text-sm text-muted-foreground">Aucun lot.</TableCell></TableRow>
              )}
          </ComiteTable>
        </CardContent>
      </Card>

      {/* Barre sticky de publication */}
      {currentLot && (
        <div className="sticky bottom-0 -mx-4 sm:mx-0 mt-4 rounded-sm border border-ink bg-ink text-parch hard-shadow-ink">
          <div className="flex flex-wrap items-center gap-4 px-4 py-3">
            <div className="flex items-center gap-2 mono-eyebrow">
              <Lock className="h-3.5 w-3.5 text-ochre" />
              Lot v{currentLot.version_cible}
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="text-parch/80">Brouillon: <b className="tabular-nums text-parch">{cs["brouillon"] ?? 0}</b></span>
              <span className="text-parch/80">Soumise: <b className="tabular-nums text-parch">{cs["soumise"] ?? 0}</b></span>
              <span className="text-parch/80">Validée: <b className="tabular-nums text-parch">{cs["validee_comite"] ?? 0}</b></span>
              <span className="text-ochre">Approuvée: <b className="tabular-nums">{approved}</b></span>
              <span className="text-clay">Renvoyée: <b className="tabular-nums">{cs["renvoyee_comite"] ?? 0}</b></span>
            </div>
            <span className="font-serif italic text-parch/70 text-[12px] hidden md:inline">
              {canPublishCurrent
                ? "Toutes les propositions sont approuvées — publication possible."
                : "Publication possible uniquement quand toutes les propositions du lot sont approuvées par l'admin."}
            </span>
            <Button
              size="sm"
              variant={canPublishCurrent ? "ochre" : "ink"}
              className="ml-auto"
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
            <div className="rounded-sm border border-line p-2">
              <div className="text-2xl font-semibold tabular-nums">{publish?.nbNormes ?? 0}</div>
              <div className="mono-eyebrow text-mute">Normes modifiées</div>
            </div>
            <div className="rounded-sm border border-line p-2">
              <div className="text-2xl font-semibold tabular-nums">{publish?.nbProfils ?? 0}</div>
              <div className="mono-eyebrow text-mute">Profils touchés</div>
            </div>
            <div className="rounded-sm border border-line p-2">
              <div className="text-2xl font-semibold tabular-nums">{impact?.projets ?? "…"}</div>
              <div className="mono-eyebrow text-mute">Projets clients</div>
            </div>
          </div>
          <div className="rounded-sm border border-ochre bg-ochre/15 text-ink p-3 text-xs">
            <strong>Cette action est irréversible.</strong> La version sera figée à jamais. Toute correction exigera une nouvelle version. Les documents déjà générés restent vérifiables sur leur version d'origine.
          </div>
          <div>
            <Label className="mono-eyebrow text-mute">Note de version (visible par les clients, min. 10 car.)</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. Révision des besoins hydriques Avocat Zone Souss suite à campagne 2025-2026." />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublish(null)}>Annuler</Button>
            <Button variant="clay" onClick={doPublish} disabled={busy || note.trim().length < 10}>
              Publier et figer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
