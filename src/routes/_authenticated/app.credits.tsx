import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useWallet, usePricing } from "@/hooks/use-wallet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Coins, ArrowLeft, Info } from "lucide-react";
import { BackButton } from "@/components/agriplan/BackButton";

export const Route = createFileRoute("/_authenticated/app/credits")({
  ssr: false,
  component: CreditsPage,
});

const PACKS = [
  { code: "starter", credits: 10, mad: 1000 },
  { code: "pro", credits: 50, mad: 4500 },
  { code: "enterprise", credits: 200, mad: 16000 },
];

function CreditsPage() {
  const { current } = useCurrentOrg();
  const wallet = useWallet();
  const pricing = usePricing();
  const qc = useQueryClient();

  const ledger = useQuery({
    queryKey: ["credit_ledger", current?.org_id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_ledger")
        .select("id, delta, solde_apres, type, action, ref_id, motif, at, auteur_id")
        .eq("org_id", current!.org_id)
        .order("at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const requests = useQuery({
    queryKey: ["credit_requests_mine", current?.org_id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_requests")
        .select("id, pack, credits, montant_mad, statut, message, motif_refus, created_at, traitee_le")
        .eq("org_id", current!.org_id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!current) return <div>—</div>;

  const credits = wallet.data?.credits ?? 0;
  const isOwner = current.role === "owner";

  return (
    <div className="space-y-6">
      <BackButton to="/dashboard" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mes crédits</h1>
          <p className="text-muted-foreground">Solde de l'organisation · consommation et grand livre.</p>
        </div>
      </div>

      <div className="rounded-md border border-accent/50 bg-accent/10 p-3 text-sm flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <strong>Mode&nbsp;: octroi manuel.</strong> Le règlement s'effectue par virement sur facture AGRIDATA. Vos crédits sont crédités à réception. Aucune donnée bancaire n'est traitée.
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardDescription>Solde actuel</CardDescription>
            <CardTitle className="flex items-center gap-2 text-4xl tabular-nums">
              <Coins className="h-6 w-6" /> {credits}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <div>Plan : <strong>{wallet.data?.plan ?? "—"}</strong></div>
            <div>Seuil d'alerte : {wallet.data?.credits_alerte ?? 3}</div>
            {credits === 0 && (
              <div className="mt-2 rounded border border-accent/40 bg-accent/10 p-2">
                La pré-faisabilité et la re-prévision restent gratuites.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Grille tarifaire</CardTitle>
            <CardDescription>On facture la génération et la profondeur, jamais la modification.</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {(pricing.data ?? []).filter((p) => p.actif).map((p) => (
                  <tr key={p.action}>
                    <td className="py-2">{p.label}</td>
                    <td className="py-2 text-end tabular-nums">
                      {p.cout === 0 ? <span className="text-muted-foreground">gratuit</span> : <strong>{p.cout} crédit{p.cout > 1 ? "s" : ""}</strong>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Demander des crédits</h2>
        {isOwner && <RequestCreditsDialog orgId={current.org_id} onDone={() => qc.invalidateQueries({ queryKey: ["credit_requests_mine"] })} />}
      </div>

      {(requests.data ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Mes demandes</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="p-2 text-start">Date</th>
                  <th className="p-2 text-start">Pack</th>
                  <th className="p-2 text-end">Crédits</th>
                  <th className="p-2 text-end">Montant</th>
                  <th className="p-2 text-start">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {requests.data!.map((r) => (
                  <tr key={r.id}>
                    <td className="p-2">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="p-2">{r.pack}</td>
                    <td className="p-2 text-end tabular-nums">{r.credits}</td>
                    <td className="p-2 text-end tabular-nums">{r.montant_mad ? `${r.montant_mad} MAD` : "—"}</td>
                    <td className="p-2">
                      <StatutBadge s={r.statut} />
                      {r.statut === "refusee" && r.motif_refus && (
                        <div className="text-xs text-muted-foreground mt-0.5">{r.motif_refus}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Grand livre</CardTitle><CardDescription>Historique complet — append-only, non modifiable.</CardDescription></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="p-2 text-start">Date</th>
                <th className="p-2 text-start">Type</th>
                <th className="p-2 text-start">Action</th>
                <th className="p-2 text-end">Δ</th>
                <th className="p-2 text-end">Solde</th>
                <th className="p-2 text-start">Motif</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(ledger.data ?? []).map((e: any) => (
                <tr key={e.id}>
                  <td className="p-2 whitespace-nowrap">{new Date(e.at).toLocaleString()}</td>
                  <td className="p-2"><LedgerTypeBadge t={e.type} /></td>
                  <td className="p-2">
                    {e.action ?? "—"}
                    {e.ref_id && e.action === "bp_complet" && (
                      <Link to="/app/business-plans/$id" params={{ id: e.ref_id }} className="ml-1 text-xs underline">voir</Link>
                    )}
                    {e.ref_id && e.action === "budget_campagne" && (
                      <Link to="/app/budgets/$id" params={{ id: e.ref_id }} className="ml-1 text-xs underline">voir</Link>
                    )}
                  </td>
                  <td className={`p-2 text-end tabular-nums font-semibold ${e.delta < 0 ? "text-destructive" : "text-primary"}`}>
                    {e.delta > 0 ? `+${e.delta}` : e.delta}
                  </td>
                  <td className="p-2 text-end tabular-nums">{e.solde_apres}</td>
                  <td className="p-2 text-xs text-muted-foreground">{e.motif ?? ""}</td>
                </tr>
              ))}
              {(ledger.data ?? []).length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucune écriture.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatutBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    en_attente: "border-accent/50 bg-accent/10 text-accent-foreground",
    accordee: "border-primary/40 bg-primary/10 text-primary",
    refusee: "border-destructive/40 bg-destructive/10 text-destructive",
  };
  const label: Record<string, string> = { en_attente: "En attente", accordee: "Accordée", refusee: "Refusée" };
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs ${map[s] ?? ""}`}>{label[s] ?? s}</span>;
}

function LedgerTypeBadge({ t }: { t: string }) {
  const label: Record<string, string> = {
    octroi_admin: "Octroi",
    consommation: "Conso.",
    remboursement: "Remb.",
    ajustement: "Ajust.",
    achat_en_ligne: "Achat",
  };
  return <span className="text-xs rounded border px-1.5 py-0.5">{label[t] ?? t}</span>;
}

function RequestCreditsDialog({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pack, setPack] = useState(PACKS[0].code);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const chosen = PACKS.find((p) => p.code === pack)!;

  async function submit() {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("credit_requests").insert({
        org_id: orgId,
        demandeur_id: u.user!.id,
        pack: chosen.code,
        credits: chosen.credits,
        montant_mad: chosen.mad,
        message: message || null,
      });
      if (error) throw error;
      toast.success("Demande envoyée. L'admin vous répondra après règlement.");
      setOpen(false);
      setMessage("");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Demander des crédits</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Demande de crédits</DialogTitle>
          <DialogDescription>Encaissement hors plateforme (virement / facture AGRIDATA).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Pack</Label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {PACKS.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => setPack(p.code)}
                  className={`rounded border p-3 text-start text-sm ${pack === p.code ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div className="font-semibold capitalize">{p.code}</div>
                  <div className="text-xs text-muted-foreground">{p.credits} crédits · {p.mad} MAD</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="msg">Message (optionnel)</Label>
            <Textarea id="msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={submit} disabled={busy}>Envoyer la demande</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}