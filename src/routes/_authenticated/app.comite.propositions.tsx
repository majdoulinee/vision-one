import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ComiteShell } from "@/components/agriplan/ComiteShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatError } from "@/lib/format-error";

export const Route = createFileRoute("/_authenticated/app/comite/propositions")({
  ssr: false,
  component: () => <ComiteShell><PropView /></ComiteShell>,
});

function PropView() {
  const qc = useQueryClient();
  const props = useQuery({
    queryKey: ["comite_propositions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ref_propositions").select("*, ref_lots(version_cible)").order("cree_le", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const lots = useQuery({
    queryKey: ["comite_lots_active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ref_lots").select("*").in("statut", ["en_preparation","soumis_admin","autorise_publication"]).order("cree_le", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function submit(id: string) {
    try {
      const { error } = await supabase.rpc("comite_submit_proposition", { p_id: id });
      if (error) throw error;
      toast.success("Soumise à l'admin.");
      qc.invalidateQueries();
    } catch (e) { toast.error(formatError(e)); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>Propositions ({props.data?.length ?? 0})</CardTitle>
            <CardDescription>Cycle : brouillon → validée comité → approuvée admin → publiée.</CardDescription>
          </div>
          <div className="flex gap-2">
            <NewLotDialog onDone={() => qc.invalidateQueries()} />
            <NewPropositionDialog lots={lots.data ?? []} onDone={() => qc.invalidateQueries()} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {(props.data ?? []).map((p: any) => (
              <div key={p.id} className="p-3 flex flex-wrap items-start gap-3 justify-between">
                <div className="text-sm space-y-1">
                  <div className="font-mono text-xs uppercase tracking-wider">{p.cle_norme} · {p.profil_code ?? "—"} / {p.zone_code ?? "—"} · v.{p.ref_lots?.version_cible}</div>
                  <div className="text-xs">Ancienne : <code className="bg-muted px-1 rounded">{JSON.stringify(p.ancienne_valeur)}</code> → Nouvelle : <code className="bg-primary/10 px-1 rounded">{JSON.stringify(p.nouvelle_valeur)}</code></div>
                  <div className="text-xs text-muted-foreground italic">« {p.justification} » · Provenance : {p.provenance}</div>
                  {p.motif_renvoi && <div className="text-xs text-destructive">Renvoi admin : {p.motif_renvoi}</div>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider rounded border px-1.5 py-0.5">{p.statut}</span>
                  {(p.statut === "brouillon" || p.statut === "renvoyee_comite") && (
                    <Button size="sm" onClick={() => submit(p.id)}>Soumettre</Button>
                  )}
                </div>
              </div>
            ))}
            {(props.data ?? []).length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">Aucune proposition pour l'instant.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NewLotDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  async function submit() {
    const { error } = await supabase.from("ref_lots").insert({ version_cible: v.trim() });
    if (error) return toast.error(error.message);
    toast.success("Lot créé.");
    setOpen(false); setV(""); onDone();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>+ Lot</Button>
      <DialogContent>
        <DialogHeader><DialogTitle>Créer un lot (future version)</DialogTitle></DialogHeader>
        <Label>Version cible</Label>
        <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="2026.3" />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={submit} disabled={!v.trim()}>Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewPropositionDialog({ lots, onDone }: { lots: any[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [lotId, setLotId] = useState("");
  const [cle, setCle] = useState("");
  const [profil, setProfil] = useState("");
  const [zone, setZone] = useState("");
  const [ancienne, setAncienne] = useState("");
  const [nouvelle, setNouvelle] = useState("");
  const [provenance, setProvenance] = useState<"comite_experts" | "bee_one">("comite_experts");
  const [justification, setJustification] = useState("");

  async function submit() {
    if (!lotId || !cle.trim() || !nouvelle.trim() || justification.trim().length < 10) {
      return toast.error("Lot, clé, nouvelle valeur et justification (≥10) requis.");
    }
    let nv: any, av: any;
    try { nv = JSON.parse(nouvelle); } catch { nv = nouvelle; }
    if (ancienne.trim()) { try { av = JSON.parse(ancienne); } catch { av = ancienne; } }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("ref_propositions").insert({
      lot_id: lotId, cle_norme: cle.trim(), profil_code: profil || null, zone_code: zone || null,
      ancienne_valeur: av, nouvelle_valeur: nv, provenance, justification: justification.trim(),
      auteur: u.user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Proposition créée (brouillon).");
    setOpen(false); setCle(""); setNouvelle(""); setAncienne(""); setJustification("");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>+ Proposition</Button>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nouvelle proposition de norme</DialogTitle></DialogHeader>
        <div className="grid gap-2 text-sm">
          <Label>Lot</Label>
          <select value={lotId} onChange={(e) => setLotId(e.target.value)} className="rounded border bg-background px-2 py-1.5">
            <option value="">—</option>
            {lots.map((l: any) => <option key={l.id} value={l.id}>v{l.version_cible} · {l.statut}</option>)}
          </select>
          <Label>Clé de norme</Label>
          <Input value={cle} onChange={(e) => setCle(e.target.value)} placeholder="besoins_eau_hebdo" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Profil</Label>
              <Input value={profil} onChange={(e) => setProfil(e.target.value)} placeholder="AVO-TEST" />
            </div>
            <div>
              <Label>Zone</Label>
              <Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="SOUSS" />
            </div>
          </div>
          <Label>Ancienne valeur (JSON, optionnel)</Label>
          <Input value={ancienne} onChange={(e) => setAncienne(e.target.value)} />
          <Label>Nouvelle valeur (JSON)</Label>
          <Input value={nouvelle} onChange={(e) => setNouvelle(e.target.value)} placeholder='{"value":42}' />
          <Label>Provenance</Label>
          <select value={provenance} onChange={(e) => setProvenance(e.target.value as any)} className="rounded border bg-background px-2 py-1.5">
            <option value="comite_experts">Comité d'experts</option>
            <option value="bee_one">Bee One (ingestion)</option>
          </select>
          <Label>Justification (≥10 car.)</Label>
          <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={3} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={submit}>Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
