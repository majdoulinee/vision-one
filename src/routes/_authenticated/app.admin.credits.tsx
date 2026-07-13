import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformRole } from "@/hooks/use-platform-role";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { BackButton } from "@/components/agriplan/BackButton";
import { Info, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin/credits")({
  ssr: false,
  component: AdminCredits,
});

function AdminCredits() {
  const { data: role, isLoading, isFetching } = usePlatformRole();
  if (isLoading || isFetching || role === undefined) return <div>Chargement…</div>;
  if (role !== "admin") return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-6">
      <BackButton to="/dashboard" />
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel crédits</h1>
          <p className="text-muted-foreground">Administration des soldes, demandes, grand livre et tarification.</p>
        </div>
      </div>

      <div className="rounded-md border border-accent/60 bg-accent/15 p-3 text-sm flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <strong>Mode&nbsp;: OCTROI MANUEL.</strong> Encaissement hors plateforme (virement / facture AGRIDATA). Aucune donnée bancaire n'est traitée par Vision One.
          <span className="ml-2 opacity-70">(activation du paiement en ligne — bientôt)</span>
        </div>
      </div>

      <Tabs defaultValue="orgs" className="w-full">
        <TabsList>
          <TabsTrigger value="orgs">Organisations</TabsTrigger>
          <TabsTrigger value="requests">Demandes<PendingCount /></TabsTrigger>
          <TabsTrigger value="ledger">Grand livre</TabsTrigger>
          <TabsTrigger value="pricing">Tarifs</TabsTrigger>
        </TabsList>
        <TabsContent value="orgs" className="mt-4"><OrgsTab /></TabsContent>
        <TabsContent value="requests" className="mt-4"><RequestsTab /></TabsContent>
        <TabsContent value="ledger" className="mt-4"><LedgerTab /></TabsContent>
        <TabsContent value="pricing" className="mt-4"><PricingTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function PendingCount() {
  const q = useQuery({
    queryKey: ["admin_requests_pending_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("credit_requests")
        .select("id", { count: "exact", head: true })
        .eq("statut", "en_attente");
      if (error) throw error;
      return count ?? 0;
    },
  });
  if (!q.data) return null;
  return <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">{q.data}</span>;
}

function OrgsTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const orgs = useQuery({
    queryKey: ["admin_orgs_wallets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id,name,type,country,created_at, wallets(credits, plan, credits_alerte, updated_at), org_members(user_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = useMemo(() => {
    const list = orgs.data ?? [];
    const s = q.trim().toLowerCase();
    return s ? list.filter((o: any) => o.name?.toLowerCase().includes(s)) : list;
  }, [orgs.data, q]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div><CardTitle>Organisations & soldes</CardTitle><CardDescription>{rows.length} organisation(s)</CardDescription></div>
        <Input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="p-2 text-start">Organisation</th>
              <th className="p-2 text-start">Type</th>
              <th className="p-2 text-end">Membres</th>
              <th className="p-2 text-end">Solde</th>
              <th className="p-2 text-end">Plan</th>
              <th className="p-2 text-end">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((o: any) => {
              const w = Array.isArray(o.wallets) ? o.wallets[0] : o.wallets;
              const credits = w?.credits ?? 0;
              const alerte = w?.credits_alerte ?? 3;
              const tone = credits === 0 ? "bg-destructive/10" : credits <= alerte ? "bg-accent/10" : "";
              return (
                <tr key={o.id} className={tone}>
                  <td className="p-2 font-medium">{o.name}</td>
                  <td className="p-2 text-muted-foreground">{o.type}</td>
                  <td className="p-2 text-end tabular-nums">{o.org_members?.length ?? 0}</td>
                  <td className="p-2 text-end tabular-nums font-semibold">{credits}</td>
                  <td className="p-2 text-end">{w?.plan ?? "—"}</td>
                  <td className="p-2 text-end">
                    <GrantDialog orgId={o.id} orgName={o.name} currentBalance={credits} onDone={() => qc.invalidateQueries()} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function GrantDialog({ orgId, orgName, currentBalance, onDone }: { orgId: string; orgName: string; currentBalance: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState(10);
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (motif.trim().length < 10) { toast.error("Motif requis (10 caractères minimum)."); return; }
    if (delta === 0) { toast.error("Delta doit être non nul."); return; }
    setBusy(true);
    try {
      const type = delta > 0 ? "octroi_admin" : "ajustement";
      const { error } = await supabase.rpc("grant_credits", {
        p_org_id: orgId, p_delta: delta, p_motif: motif, p_type: type,
      });
      if (error) throw error;
      toast.success(`Solde ${currentBalance} → ${currentBalance + delta}`);
      setOpen(false);
      setMotif("");
      setDelta(10);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>+ Octroyer</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Octroyer / Ajuster · {orgName}</DialogTitle>
          <DialogDescription>Solde actuel <strong>{currentBalance}</strong> → nouveau <strong>{currentBalance + delta}</strong></DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="delta">Crédits (négatif pour un ajustement)</Label>
            <Input id="delta" type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="motif">Motif (obligatoire, min. 10 caractères)</Label>
            <Textarea id="motif" value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} placeholder="Ex : Règlement facture INV-2026-0142 · virement du 12/07…" />
            <div className="text-xs text-muted-foreground mt-1">{motif.length}/10</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={submit} disabled={busy}>Confirmer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestsTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"en_attente" | "accordee" | "refusee" | "all">("en_attente");
  const requests = useQuery({
    queryKey: ["admin_credit_requests", filter],
    queryFn: async () => {
      let q = supabase
        .from("credit_requests")
        .select("id, org_id, demandeur_id, pack, credits, montant_mad, statut, message, motif_refus, created_at, organizations(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter !== "all") q = q.eq("statut", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
  const [refuseId, setRefuseId] = useState<string | null>(null);
  const [refuseMotif, setRefuseMotif] = useState("");

  async function decide(id: string, decision: "accordee" | "refusee", motif?: string) {
    try {
      const { error } = await supabase.rpc("decide_credit_request", { p_request_id: id, p_decision: decision, p_motif: motif });
      if (error) throw error;
      toast.success(decision === "accordee" ? "Crédits octroyés." : "Demande refusée.");
      setRefuseId(null); setRefuseMotif("");
      qc.invalidateQueries();
    } catch (e: any) { toast.error(e?.message ?? String(e)); }
  }

  return (
    <>
      <div className="mb-3 flex gap-2">
        {(["en_attente","accordee","refusee","all"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "all" ? "Toutes" : f === "en_attente" ? "En attente" : f === "accordee" ? "Accordées" : "Refusées"}
          </Button>
        ))}
      </div>
      <div className="grid gap-3">
        {(requests.data ?? []).map((r: any) => (
          <Card key={r.id}>
            <CardContent className="pt-4 flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="font-semibold">{r.organizations?.name ?? r.org_id}</div>
                <div className="text-sm">
                  Pack <strong>{r.pack}</strong> · {r.credits} crédits · {r.montant_mad ? `${r.montant_mad} MAD` : "—"}
                </div>
                {r.message && <div className="text-sm text-muted-foreground">« {r.message} »</div>}
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                {r.motif_refus && <div className="text-xs text-destructive">Refus : {r.motif_refus}</div>}
              </div>
              {r.statut === "en_attente" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decide(r.id, "accordee")}>Accorder</Button>
                  <Button size="sm" variant="outline" onClick={() => setRefuseId(r.id)}>Refuser…</Button>
                </div>
              )}
              {r.statut !== "en_attente" && (
                <span className="text-xs rounded border px-2 py-1">{r.statut}</span>
              )}
            </CardContent>
          </Card>
        ))}
        {(requests.data ?? []).length === 0 && <div className="text-sm text-muted-foreground p-6 text-center">Aucune demande.</div>}
      </div>

      <Dialog open={!!refuseId} onOpenChange={(o) => !o && setRefuseId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Motif du refus</DialogTitle></DialogHeader>
          <Textarea rows={3} value={refuseMotif} onChange={(e) => setRefuseMotif(e.target.value)} placeholder="Explication (min. 5 caractères)" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRefuseId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => refuseId && decide(refuseId, "refusee", refuseMotif)} disabled={refuseMotif.trim().length < 5}>
              Refuser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LedgerTab() {
  const [type, setType] = useState<string>("all");
  const rows = useQuery({
    queryKey: ["admin_ledger", type],
    queryFn: async () => {
      let q = supabase
        .from("credit_ledger")
        .select("id, org_id, delta, solde_apres, type, action, motif, at, auteur_id, organizations(name)")
        .order("at", { ascending: false })
        .limit(500);
      if (type !== "all") q = q.eq("type", type);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  function exportCsv() {
    const list = rows.data ?? [];
    const header = ["at","org","type","action","delta","solde_apres","auteur","motif"];
    const csv = [header.join(",")].concat(
      list.map((r: any) => [
        r.at, JSON.stringify(r.organizations?.name ?? r.org_id), r.type, r.action ?? "", r.delta, r.solde_apres, r.auteur_id ?? "", JSON.stringify(r.motif ?? ""),
      ].join(","))
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ledger-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div><CardTitle>Grand livre global</CardTitle><CardDescription>Append-only · {rows.data?.length ?? 0} écritures (max 500)</CardDescription></div>
        <div className="flex gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded border bg-background px-2 py-1 text-sm">
            <option value="all">Tous les types</option>
            <option value="octroi_admin">Octrois admin</option>
            <option value="consommation">Consommations</option>
            <option value="remboursement">Remboursements</option>
            <option value="ajustement">Ajustements</option>
          </select>
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="p-2 text-start">Date</th>
              <th className="p-2 text-start">Org</th>
              <th className="p-2 text-start">Type</th>
              <th className="p-2 text-start">Action</th>
              <th className="p-2 text-end">Δ</th>
              <th className="p-2 text-end">Solde</th>
              <th className="p-2 text-start">Motif</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(rows.data ?? []).map((r: any) => (
              <tr key={r.id}>
                <td className="p-2 whitespace-nowrap">{new Date(r.at).toLocaleString()}</td>
                <td className="p-2">{r.organizations?.name ?? r.org_id.slice(0,8)}</td>
                <td className="p-2">{r.type}</td>
                <td className="p-2">{r.action ?? "—"}</td>
                <td className={`p-2 text-end tabular-nums font-semibold ${r.delta < 0 ? "text-destructive" : "text-primary"}`}>{r.delta > 0 ? `+${r.delta}` : r.delta}</td>
                <td className="p-2 text-end tabular-nums">{r.solde_apres}</td>
                <td className="p-2 text-xs text-muted-foreground">{r.motif ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function PricingTab() {
  const qc = useQueryClient();
  const rows = useQuery({
    queryKey: ["admin_pricing"],
    queryFn: async () => {
      const { data, error } = await supabase.from("credit_pricing").select("action,label,cout,actif,updated_at").order("cout");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function update(action: string, patch: { cout?: number; actif?: boolean }) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("credit_pricing").update({ ...patch, updated_at: new Date().toISOString(), updated_by: u.user!.id }).eq("action", action);
    if (error) return toast.error(error.message);
    toast.success("Tarif mis à jour");
    qc.invalidateQueries({ queryKey: ["admin_pricing"] });
    qc.invalidateQueries({ queryKey: ["credit_pricing"] });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grille tarifaire</CardTitle>
        <CardDescription>
          Modifier un coût n'affecte que les consommations futures. Les documents déjà générés conservent le coût appliqué au moment de leur génération.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="p-2 text-start">Action</th>
              <th className="p-2 text-start">Libellé</th>
              <th className="p-2 text-end">Coût</th>
              <th className="p-2 text-end">Actif</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(rows.data ?? []).map((r: any) => (
              <tr key={r.action}>
                <td className="p-2 font-mono text-xs">{r.action}</td>
                <td className="p-2">{r.label}</td>
                <td className="p-2 text-end">
                  <Input
                    type="number" min={0}
                    className="w-20 ml-auto text-end tabular-nums"
                    defaultValue={r.cout}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== r.cout && v >= 0) update(r.action, { cout: v });
                    }}
                  />
                </td>
                <td className="p-2 text-end">
                  <Switch checked={r.actif} onCheckedChange={(v) => update(r.action, { actif: v })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}