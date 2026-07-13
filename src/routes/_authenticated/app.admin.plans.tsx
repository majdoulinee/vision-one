import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/agriplan/AdminShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatError } from "@/lib/format-error";

export const Route = createFileRoute("/_authenticated/app/admin/plans")({
  ssr: false,
  component: () => <AdminShell><PlansView /></AdminShell>,
});

function PlansView() {
  const qc = useQueryClient();
  const plans = useQuery({
    queryKey: ["admin_plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("prix_mad");
      if (error) throw error;
      return data ?? [];
    },
  });
  const orgs = useQuery({
    queryKey: ["admin_orgs_light"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations")
        .select("id, name, wallets(plan_code)").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function updatePlan(code: string, patch: any) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("plans").update({ ...patch, updated_at: new Date().toISOString(), updated_by: u.user?.id }).eq("code", code);
    if (error) return toast.error(error.message);
    toast.success("Plan mis à jour.");
    qc.invalidateQueries({ queryKey: ["admin_plans"] });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Grille crédits</CardTitle>
          <CardDescription>
            La grille action → coût est gérée dans l'onglet <Link to="/app/admin/credits" className="underline">Crédits</Link>.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plans d'abonnement</CardTitle>
          <CardDescription>Prix MAD/mois, quota de générations/jour, crédits inclus. Modifier n'affecte que les futures assignations.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-muted/50 text-xs uppercase font-mono tracking-wider">
              <tr>
                <th className="p-2 text-start">Code</th>
                <th className="p-2 text-start">Libellé</th>
                <th className="p-2 text-end">Prix MAD</th>
                <th className="p-2 text-end">Quota gen/j</th>
                <th className="p-2 text-end">Crédits/mois</th>
                <th className="p-2 text-end">Marque blanche</th>
                <th className="p-2 text-end">Actif</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(plans.data ?? []).map((p: any) => (
                <tr key={p.code}>
                  <td className="p-2 font-mono text-xs">{p.code}</td>
                  <td className="p-2">{p.label}</td>
                  <td className="p-2 text-end"><Input type="number" min={0} className="w-24 ml-auto text-end tabular-nums" defaultValue={p.prix_mad} onBlur={(e) => { const v = Number(e.target.value); if (v !== p.prix_mad) updatePlan(p.code, { prix_mad: v }); }} /></td>
                  <td className="p-2 text-end"><Input type="number" min={0} className="w-20 ml-auto text-end tabular-nums" defaultValue={p.quota_gen_jour} onBlur={(e) => { const v = Number(e.target.value); if (v !== p.quota_gen_jour) updatePlan(p.code, { quota_gen_jour: v }); }} /></td>
                  <td className="p-2 text-end"><Input type="number" min={0} className="w-20 ml-auto text-end tabular-nums" defaultValue={p.credits_mensuels} onBlur={(e) => { const v = Number(e.target.value); if (v !== p.credits_mensuels) updatePlan(p.code, { credits_mensuels: v }); }} /></td>
                  <td className="p-2 text-end"><Switch checked={p.marque_blanche} onCheckedChange={(v) => updatePlan(p.code, { marque_blanche: v })} /></td>
                  <td className="p-2 text-end"><Switch checked={p.actif} onCheckedChange={(v) => updatePlan(p.code, { actif: v })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assigner un plan à une organisation</CardTitle>
          <CardDescription>Paiement manuel : n'activer qu'après réception de la facture. Les crédits inclus sont crédités automatiquement au ledger.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-muted/50 text-xs uppercase font-mono tracking-wider">
              <tr>
                <th className="p-2 text-start">Organisation</th>
                <th className="p-2 text-start">Plan actuel</th>
                <th className="p-2 text-end">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(orgs.data ?? []).map((o: any) => {
                const w = Array.isArray(o.wallets) ? o.wallets[0] : o.wallets;
                return (
                  <tr key={o.id}>
                    <td className="p-2 font-medium">{o.name}</td>
                    <td className="p-2 font-mono text-xs">{w?.plan_code ?? "—"}</td>
                    <td className="p-2 text-end">
                      <AssignPlanDialog orgId={o.id} orgName={o.name} plans={plans.data ?? []} onDone={() => qc.invalidateQueries()} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function AssignPlanDialog({ orgId, orgName, plans, onDone }: { orgId: string; orgName: string; plans: any[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(plans[0]?.code ?? "");
  const [facture, setFacture] = useState("");
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!code) return toast.error("Choisir un plan.");
    if (motif.trim().length < 10) return toast.error("Motif requis (min. 10 caractères).");
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_assign_plan", { p_org_id: orgId, p_plan_code: code, p_facture_ref: facture || null, p_motif: motif });
      if (error) throw error;
      toast.success(`Plan ${code} assigné à ${orgName}.`);
      setOpen(false); setFacture(""); setMotif("");
      onDone();
    } catch (e) { toast.error(formatError(e)); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Assigner…</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assigner un plan · {orgName}</DialogTitle>
          <DialogDescription>Les crédits inclus dans le plan seront octroyés immédiatement au wallet.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Plan</Label>
            <select value={code} onChange={(e) => setCode(e.target.value)} className="w-full rounded border bg-background px-2 py-1.5 text-sm">
              {plans.filter((p) => p.actif).map((p) => (
                <option key={p.code} value={p.code}>{p.label} — {p.prix_mad} MAD · {p.credits_mensuels} crédits/mois</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Référence facture (optionnel)</Label>
            <Input value={facture} onChange={(e) => setFacture(e.target.value)} placeholder="INV-2026-0142" />
          </div>
          <div>
            <Label>Motif (min. 10 car.)</Label>
            <Input value={motif} onChange={(e) => setMotif(e.target.value)} />
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
