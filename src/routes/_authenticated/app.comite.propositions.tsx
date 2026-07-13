import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/comite/propositions")({
  ssr: false,
  component: () => <ComiteShell><PropView /></ComiteShell>,
});

type Filter = "all" | "gt10" | "bee_one" | "comite_experts";

function isArrayOf52(v: any): v is number[] {
  return Array.isArray(v) && v.length === 52 && v.every((n) => typeof n === "number" && Number.isFinite(n));
}
function toNum(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(+v)) return +v;
  if (v && typeof v === "object" && "value" in v && typeof v.value === "number") return v.value;
  return null;
}
function sum(a: number[]) { return a.reduce((x, y) => x + y, 0); }
function pctDelta(av: any, nv: any): number | null {
  if (isArrayOf52(av) && isArrayOf52(nv)) {
    const sa = sum(av); if (sa === 0) return null;
    return ((sum(nv) - sa) / sa) * 100;
  }
  const a = toNum(av), n = toNum(nv);
  if (a == null || n == null || a === 0) return null;
  return ((n - a) / a) * 100;
}

function Sparkline({ old: oldArr, next }: { old?: number[]; next?: number[] }) {
  const oldA = oldArr && isArrayOf52(oldArr) ? oldArr : null;
  const nxA = next && isArrayOf52(next) ? next : null;
  if (!oldA && !nxA) return null;
  const all = [...(oldA ?? []), ...(nxA ?? [])];
  const max = Math.max(1, ...all);
  const W = 208, H = 32, bw = W / 52;
  return (
    <svg width={W} height={H} className="block">
      {oldA?.map((v, i) => {
        const h = (v / max) * (H - 2);
        return <rect key={"o"+i} x={i * bw} y={H - h} width={bw - 0.5} height={h} fill="#c9c9c9" />;
      })}
      {nxA?.map((v, i) => {
        const h = (v / max) * (H - 2);
        return <rect key={"n"+i} x={i * bw + bw * 0.15} y={H - h} width={bw * 0.7} height={h} fill="#2E6E8E" opacity={0.85} />;
      })}
    </svg>
  );
}

function PropView() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const props = useQuery({
    queryKey: ["comite_propositions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ref_propositions")
        .select("*, ref_lots(version_cible, statut)")
        .order("cree_le", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const lots = useQuery({
    queryKey: ["comite_lots_active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ref_lots").select("*").neq("statut", "publie").order("cree_le", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const profils = useQuery({
    queryKey: ["profils_production_list"],
    queryFn: async () => (await supabase.from("profils_production").select("code, name").order("code")).data ?? [],
  });
  const zones = useQuery({
    queryKey: ["zones_list"],
    queryFn: async () => (await supabase.from("zones").select("code, name").order("code")).data ?? [],
  });

  const filtered = useMemo(() => {
    const rows = props.data ?? [];
    return rows.filter((p: any) => {
      if (filter === "bee_one") return p.provenance === "bee_one";
      if (filter === "comite_experts") return p.provenance === "comite_experts";
      if (filter === "gt10") {
        const d = pctDelta(p.ancienne_valeur, p.nouvelle_valeur);
        return d != null && Math.abs(d) > 10;
      }
      return true;
    });
  }, [props.data, filter]);

  async function submit(id: string) {
    try {
      const { error } = await supabase.rpc("comite_submit_proposition", { p_id: id });
      if (error) throw error;
      toast.success("Validée par le comité.");
      qc.invalidateQueries();
    } catch (e) { toast.error(formatError(e)); }
  }

  function openEditor(p: any | null) {
    setEditing(p);
    setEditorOpen(true);
  }

  const counts = {
    all: (props.data ?? []).length,
    gt10: (props.data ?? []).filter((p: any) => { const d = pctDelta(p.ancienne_valeur, p.nouvelle_valeur); return d != null && Math.abs(d) > 10; }).length,
    bee_one: (props.data ?? []).filter((p: any) => p.provenance === "bee_one").length,
    comite_experts: (props.data ?? []).filter((p: any) => p.provenance === "comite_experts").length,
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>Lot de version · {filtered.length} proposition(s)</CardTitle>
            <CardDescription>Cycle : brouillon → validée comité → approuvée admin → publiée · immuable.</CardDescription>
          </div>
          <div className="flex gap-2">
            <NewLotDialog onDone={() => qc.invalidateQueries()} />
            <Button size="sm" onClick={() => openEditor(null)}><Sparkles className="h-3.5 w-3.5 mr-1" /> Nouvelle proposition</Button>
          </div>
        </CardHeader>
        <div className="px-6 pb-3 flex flex-wrap gap-1">
          {(["all","gt10","bee_one","comite_experts"] as Filter[]).map((f) => (
            <button key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border ${filter === f ? "bg-foreground text-background" : "hover:bg-muted"}`}>
              {f === "all" ? "Toutes" : f === "gt10" ? "Écarts > 10 %" : f === "bee_one" ? "Bee One" : "Comité"}
              <span className="ml-1 opacity-70 tabular-nums">{counts[f]}</span>
            </button>
          ))}
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-muted/50 text-[10px] uppercase font-mono tracking-wider">
              <tr>
                <th className="p-2 w-6"></th>
                <th className="p-2 text-start">Norme</th>
                <th className="p-2 text-start">Courbe hebdo</th>
                <th className="p-2 text-end">v courante → v proposée</th>
                <th className="p-2 text-end">Δ %</th>
                <th className="p-2 text-start">Provenance</th>
                <th className="p-2 text-start">Statut</th>
                <th className="p-2 text-end">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p: any) => {
                const d = pctDelta(p.ancienne_valeur, p.nouvelle_valeur);
                const hasCurve = isArrayOf52(p.ancienne_valeur) || isArrayOf52(p.nouvelle_valeur);
                const strong = d != null && Math.abs(d) > 10;
                const isOpen = expanded.has(p.id);
                const editable = p.statut === "brouillon" || p.statut === "renvoyee_comite";
                return (
                  <>
                    <tr key={p.id} className={strong ? "bg-[hsl(15,60%,95%)]" : undefined}>
                      <td className="p-2 align-top">
                        <button onClick={() => setExpanded((s) => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; })}>
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="p-2 align-top">
                        <div className="font-medium text-sm">{p.cle_norme}</div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{p.profil_code ?? "—"} · {p.zone_code ?? "—"} · v.{p.ref_lots?.version_cible}</div>
                      </td>
                      <td className="p-2 align-top">
                        {hasCurve ? (
                          <Sparkline old={isArrayOf52(p.ancienne_valeur) ? p.ancienne_valeur as number[] : undefined}
                                     next={isArrayOf52(p.nouvelle_valeur) ? p.nouvelle_valeur as number[] : undefined} />
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-mono">— scalaire —</span>
                        )}
                      </td>
                      <td className="p-2 align-top text-end text-xs">
                        <div className="line-through text-muted-foreground">{fmtValue(p.ancienne_valeur)}</div>
                        <div className="font-semibold">{fmtValue(p.nouvelle_valeur)}</div>
                      </td>
                      <td className="p-2 align-top text-end tabular-nums text-xs">
                        {d != null ? (
                          <span className="font-semibold" style={{ color: d > 0 ? "#C0552F" : "#2E6E8E" }}>
                            {d > 0 ? "+" : ""}{d.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="p-2 align-top">
                        {p.provenance === "bee_one" ? (
                          <span className="text-[10px] font-mono uppercase tracking-wider rounded px-1.5 py-0.5" style={{ background: "#2E6E8E", color: "#F3EFE3" }}>
                            BEE ONE · N={p.bee_one_n ?? "?"}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono uppercase tracking-wider rounded px-1.5 py-0.5" style={{ background: "#D9A521", color: "#12211A" }}>
                            COMITÉ
                          </span>
                        )}
                      </td>
                      <td className="p-2 align-top">
                        <span className="text-[10px] font-mono uppercase tracking-wider rounded border px-1.5 py-0.5">{p.statut}</span>
                      </td>
                      <td className="p-2 align-top text-end space-x-1">
                        {editable && <Button size="sm" variant="outline" onClick={() => openEditor(p)}>Éditer</Button>}
                        {editable && <Button size="sm" onClick={() => submit(p.id)}>Valider</Button>}
                        {!editable && <Button size="sm" variant="ghost" onClick={() => setExpanded((s) => new Set(s).add(p.id))}>Détail</Button>}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-muted/20">
                        <td colSpan={8} className="p-4">
                          <div className="grid gap-4 md:grid-cols-3 text-xs">
                            <div>
                              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Justification (signée, datée)</div>
                              <p className="italic">« {p.justification} »</p>
                              <p className="text-muted-foreground mt-1">Créée le {new Date(p.cree_le).toLocaleString()}</p>
                              {p.motif_renvoi && <p className="mt-1" style={{ color: "#C0552F" }}>Renvoi admin : {p.motif_renvoi}</p>}
                            </div>
                            <div>
                              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Échantillon</div>
                              {p.provenance === "bee_one" ? (
                                <>
                                  <p>N = <b>{p.bee_one_n ?? "—"}</b></p>
                                  {p.bee_one_periode && <p>Période : {p.bee_one_periode}</p>}
                                </>
                              ) : (
                                <p>Source : comité d'experts (pas d'échantillon Bee One).</p>
                              )}
                            </div>
                            <div>
                              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Impact estimé</div>
                              <ImpactCount profilCode={p.profil_code} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-sm text-muted-foreground">Aucune proposition dans ce filtre.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <PropositionEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editing}
        lots={lots.data ?? []}
        profils={profils.data ?? []}
        zones={zones.data ?? []}
        onDone={() => { qc.invalidateQueries(); setEditorOpen(false); setEditing(null); }}
      />
    </>
  );
}

function fmtValue(v: any): string {
  if (v == null) return "—";
  if (isArrayOf52(v)) return `Σ=${sum(v).toFixed(1)}`;
  const n = toNum(v);
  if (n != null) return n.toString();
  return JSON.stringify(v);
}

function ImpactCount({ profilCode }: { profilCode: string | null }) {
  const q = useQuery({
    queryKey: ["impact_projets", profilCode],
    enabled: !!profilCode,
    queryFn: async () => {
      const { count } = await supabase.from("projects").select("id", { count: "exact", head: true }).eq("profile_code", profilCode!);
      return count ?? 0;
    },
  });
  if (!profilCode) return <p>Aucun profil ciblé.</p>;
  return (
    <p><b className="tabular-nums">{q.data ?? "…"}</b> projet(s) actif(s) référencent ce profil — la re-prévision leur sera proposée gratuitement à la publication.</p>
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

function PropositionEditor({
  open, onOpenChange, initial, lots, profils, zones, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: any | null;
  lots: any[]; profils: any[]; zones: any[];
  onDone: () => void;
}) {
  const isEdit = !!initial?.id;
  const [lotId, setLotId] = useState<string>(initial?.lot_id ?? lots[0]?.id ?? "");
  const [cle, setCle] = useState(initial?.cle_norme ?? "");
  const [profil, setProfil] = useState(initial?.profil_code ?? "");
  const [zone, setZone] = useState(initial?.zone_code ?? "");
  const [mode, setMode] = useState<"scalar" | "weekly">(isArrayOf52(initial?.nouvelle_valeur) ? "weekly" : "scalar");
  const [scalar, setScalar] = useState<string>(
    !isArrayOf52(initial?.nouvelle_valeur) && initial?.nouvelle_valeur != null
      ? String(toNum(initial.nouvelle_valeur) ?? "") : ""
  );
  const [weekly, setWeekly] = useState<number[]>(
    isArrayOf52(initial?.nouvelle_valeur) ? initial.nouvelle_valeur as number[] : Array(52).fill(0)
  );
  const [provenance, setProvenance] = useState<"comite_experts" | "bee_one">(initial?.provenance ?? "comite_experts");
  const [justification, setJustification] = useState(initial?.justification ?? "");

  // Reset when initial changes
  useMemo(() => {
    if (!open) return;
    setLotId(initial?.lot_id ?? lots[0]?.id ?? "");
    setCle(initial?.cle_norme ?? "");
    setProfil(initial?.profil_code ?? "");
    setZone(initial?.zone_code ?? "");
    setMode(isArrayOf52(initial?.nouvelle_valeur) ? "weekly" : "scalar");
    setScalar(!isArrayOf52(initial?.nouvelle_valeur) && initial?.nouvelle_valeur != null ? String(toNum(initial.nouvelle_valeur) ?? "") : "");
    setWeekly(isArrayOf52(initial?.nouvelle_valeur) ? initial.nouvelle_valeur as number[] : Array(52).fill(0));
    setProvenance(initial?.provenance ?? "comite_experts");
    setJustification(initial?.justification ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const newValue: any = mode === "weekly" ? weekly : (scalar === "" ? null : (isNaN(+scalar) ? scalar : +scalar));
  const oldValue = initial?.ancienne_valeur;
  const deltaPct = pctDelta(oldValue, newValue);

  async function save(submitAfter: boolean) {
    if (!lotId) return toast.error("Choisissez un lot.");
    if (!cle.trim()) return toast.error("Clé de norme requise.");
    if (mode === "scalar" && (scalar === "" || isNaN(+scalar))) return toast.error("Valeur scalaire numérique requise.");
    if (justification.trim().length < 20) return toast.error("Justification ≥ 20 caractères.");
    if (newValue == null) return toast.error("Nouvelle valeur requise.");
    try {
      const { data: u } = await supabase.auth.getUser();
      let propId = initial?.id as string | undefined;
      if (isEdit) {
        const { error } = await supabase.from("ref_propositions").update({
          lot_id: lotId, cle_norme: cle.trim(),
          profil_code: profil || null, zone_code: zone || null,
          nouvelle_valeur: newValue,
          provenance, justification: justification.trim(),
        }).eq("id", propId!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("ref_propositions").insert({
          lot_id: lotId, cle_norme: cle.trim(),
          profil_code: profil || null, zone_code: zone || null,
          nouvelle_valeur: newValue,
          provenance, justification: justification.trim(),
          auteur: u.user?.id,
        }).select("id").single();
        if (error) throw error;
        propId = data.id;
      }
      if (submitAfter && propId) {
        const { error } = await supabase.rpc("comite_submit_proposition", { p_id: propId });
        if (error) throw error;
        toast.success("Proposition soumise au comité.");
      } else {
        toast.success(isEdit ? "Modifications enregistrées." : "Brouillon créé.");
      }
      onDone();
    } catch (e) { toast.error(formatError(e)); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Éditer la proposition" : "Nouvelle proposition"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Lot</Label>
              <select value={lotId} onChange={(e) => setLotId(e.target.value)} className="w-full rounded border bg-background px-2 py-1.5">
                <option value="">—</option>
                {lots.map((l: any) => <option key={l.id} value={l.id}>v{l.version_cible} · {l.statut}</option>)}
              </select>
            </div>
            <div>
              <Label>Profil</Label>
              <select value={profil} onChange={(e) => setProfil(e.target.value)} className="w-full rounded border bg-background px-2 py-1.5">
                <option value="">—</option>
                {profils.map((p: any) => <option key={p.code} value={p.code}>{p.code} · {p.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Zone</Label>
              <select value={zone} onChange={(e) => setZone(e.target.value)} className="w-full rounded border bg-background px-2 py-1.5">
                <option value="">—</option>
                {zones.map((z: any) => <option key={z.code} value={z.code}>{z.code} · {z.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>Clé de norme</Label>
            <Input value={cle} onChange={(e) => setCle(e.target.value)} placeholder="besoins_eau_hebdo" />
          </div>

          <div className="flex items-center gap-2">
            <Label className="mb-0">Type de valeur :</Label>
            <div className="flex rounded border overflow-hidden text-xs font-mono uppercase tracking-wider">
              <button type="button" onClick={() => setMode("scalar")} className={`px-3 py-1 ${mode === "scalar" ? "bg-foreground text-background" : ""}`}>Scalaire</button>
              <button type="button" onClick={() => setMode("weekly")} className={`px-3 py-1 ${mode === "weekly" ? "bg-foreground text-background" : ""}`}>Hebdo (52)</button>
            </div>
          </div>

          {mode === "scalar" ? (
            <div>
              <Label>Valeur scalaire</Label>
              <Input value={scalar} onChange={(e) => setScalar(e.target.value)} placeholder="42" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>52 semaines</Label>
              <div className="rounded border p-2 bg-muted/20">
                <Sparkline old={isArrayOf52(oldValue) ? oldValue as number[] : undefined} next={weekly} />
              </div>
              <div className="grid grid-cols-13 gap-1 text-[10px]" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
                {weekly.map((v, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span className="text-muted-foreground">S{i + 1}</span>
                    <input
                      type="number"
                      value={v}
                      onChange={(e) => {
                        const nv = [...weekly]; nv[i] = +e.target.value || 0; setWeekly(nv);
                      }}
                      className="w-full rounded border bg-background px-1 py-0.5 text-center tabular-nums"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded border p-2 text-xs bg-muted/20 flex items-center justify-between">
            <span>Δ vs valeur courante :</span>
            <span className="font-semibold tabular-nums" style={{ color: deltaPct == null ? undefined : (deltaPct > 0 ? "#C0552F" : "#2E6E8E") }}>
              {deltaPct == null ? "— (pas de valeur courante ou incompatible)" : `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%`}
            </span>
          </div>

          <div>
            <Label>Provenance</Label>
            <select value={provenance} onChange={(e) => setProvenance(e.target.value as any)} className="w-full rounded border bg-background px-2 py-1.5">
              <option value="comite_experts">Comité d'experts</option>
              <option value="bee_one">Bee One (ingestion)</option>
            </select>
          </div>

          <div>
            <Label>Justification (≥ 20 caractères, signée & datée automatiquement)</Label>
            <Textarea rows={3} value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Explication de la révision, sources, contexte de campagne…" />
            <div className="text-[10px] text-muted-foreground text-end tabular-nums">{justification.length} / 20 min.</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="outline" onClick={() => save(false)}>Enregistrer brouillon</Button>
          <Button onClick={() => save(true)}>Soumettre au comité</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}