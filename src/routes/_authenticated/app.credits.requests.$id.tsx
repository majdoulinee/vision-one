import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/agriplan/BackButton";
import { CreditStatusBadge } from "@/components/agriplan/CreditStatusBadge";
import { CheckCircle2, Clock, XCircle, FileText, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/credits/requests/$id")({
  ssr: false,
  component: RequestDetailPage,
});

function RequestDetailPage() {
  const { id } = Route.useParams();

  const req = useQuery({
    queryKey: ["credit_request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_requests")
        .select("id, org_id, demandeur_id, pack, credits, montant_mad, statut, message, motif_refus, created_at, traitee_le, traitee_par")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const profiles = useQuery({
    queryKey: ["credit_request_profiles", req.data?.demandeur_id, req.data?.traitee_par],
    enabled: !!req.data,
    queryFn: async () => {
      const ids = [req.data!.demandeur_id, req.data!.traitee_par].filter(Boolean) as string[];
      if (ids.length === 0) return {};
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      if (error) throw error;
      const map: Record<string, { full_name: string | null; email: string | null }> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = { full_name: p.full_name, email: p.email }; });
      return map;
    },
  });

  const ledger = useQuery({
    queryKey: ["credit_request_ledger", id, req.data?.org_id, req.data?.statut],
    enabled: !!req.data && req.data.statut === "accordee",
    queryFn: async () => {
      const short = id.slice(0, 8);
      const { data, error } = await supabase
        .from("credit_ledger")
        .select("id, delta, solde_apres, type, at, motif")
        .eq("org_id", req.data!.org_id)
        .eq("type", "octroi_admin")
        .ilike("motif", `%req ${short}%`)
        .order("at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (req.isLoading) return <div className="text-muted-foreground">Chargement…</div>;
  if (!req.data) {
    return (
      <div className="space-y-4">
        <BackButton to="/app/credits" />
        <div className="text-muted-foreground">Demande introuvable.</div>
      </div>
    );
  }

  const r = req.data;
  const demandeur = profiles.data?.[r.demandeur_id];
  const decideur = r.traitee_par ? profiles.data?.[r.traitee_par] : undefined;

  function copyLedgerId() {
    if (!ledger.data) return;
    navigator.clipboard.writeText(ledger.data.id).then(() => toast.success("ID copié"));
  }

  return (
    <div className="space-y-6">
      <BackButton to="/app/credits" />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Demande de crédits</h1>
          <p className="text-muted-foreground text-sm">
            Référence <code className="text-xs">{r.id.slice(0, 8)}</code> · créée le {new Date(r.created_at).toLocaleString()}
          </p>
        </div>
        <CreditStatusBadge s={r.statut} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Détails</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><div className="text-muted-foreground text-xs">Pack</div><div className="font-semibold capitalize">{r.pack}</div></div>
          <div><div className="text-muted-foreground text-xs">Crédits</div><div className="font-semibold tabular-nums">{r.credits}</div></div>
          <div><div className="text-muted-foreground text-xs">Montant</div><div className="font-semibold tabular-nums">{r.montant_mad ? `${r.montant_mad} MAD` : "—"}</div></div>
          <div><div className="text-muted-foreground text-xs">Demandeur</div><div className="font-semibold truncate">{demandeur?.full_name || demandeur?.email || "—"}</div></div>
          {r.message && (
            <div className="col-span-2 md:col-span-4">
              <div className="text-muted-foreground text-xs">Message</div>
              <div className="whitespace-pre-wrap">{r.message}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des décisions</CardTitle>
          <CardDescription>Chronologie des événements liés à cette demande.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="relative ms-3 space-y-4 border-s pl-6">
            <li>
              <span className="absolute -start-2 mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Clock className="h-2.5 w-2.5" />
              </span>
              <div className="text-sm font-medium">Demande créée</div>
              <div className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString()} · par {demandeur?.full_name || demandeur?.email || "—"}
              </div>
            </li>

            {r.statut === "en_attente" && (
              <li>
                <span className="absolute -start-2 mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full border bg-accent/20 text-accent-foreground">
                  <Clock className="h-2.5 w-2.5" />
                </span>
                <div className="text-sm font-medium">En attente de décision</div>
                <div className="text-xs text-muted-foreground">
                  L'administrateur AGRIDATA vous répondra après réception du règlement (virement / facture).
                </div>
              </li>
            )}

            {r.statut === "accordee" && (
              <li>
                <span className="absolute -start-2 mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                </span>
                <div className="text-sm font-medium">Demande accordée</div>
                <div className="text-xs text-muted-foreground">
                  {r.traitee_le ? new Date(r.traitee_le).toLocaleString() : "—"}
                  {decideur ? ` · par ${decideur.full_name || decideur.email}` : ""}
                </div>
              </li>
            )}

            {r.statut === "refusee" && (
              <li>
                <span className="absolute -start-2 mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                  <XCircle className="h-2.5 w-2.5" />
                </span>
                <div className="text-sm font-medium">Demande refusée</div>
                <div className="text-xs text-muted-foreground">
                  {r.traitee_le ? new Date(r.traitee_le).toLocaleString() : "—"}
                  {decideur ? ` · par ${decideur.full_name || decideur.email}` : ""}
                </div>
                {r.motif_refus && (
                  <div className="mt-1 rounded border border-destructive/30 bg-destructive/5 p-2 text-xs">
                    <strong>Motif :</strong> {r.motif_refus}
                  </div>
                )}
              </li>
            )}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Écriture au grand livre liée</CardTitle>
          <CardDescription>Traçabilité comptable — append-only, non modifiable.</CardDescription>
        </CardHeader>
        <CardContent>
          {r.statut !== "accordee" && (
            <p className="text-sm text-muted-foreground">Aucune écriture liée pour le moment.</p>
          )}
          {r.statut === "accordee" && ledger.isLoading && (
            <p className="text-sm text-muted-foreground">Chargement de l'écriture…</p>
          )}
          {r.statut === "accordee" && !ledger.isLoading && !ledger.data && (
            <p className="text-sm text-muted-foreground">Écriture introuvable (motif non correspondant).</p>
          )}
          {ledger.data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="col-span-2 md:col-span-2">
                <div className="text-muted-foreground text-xs">ID de l'écriture</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs break-all">{ledger.data.id}</code>
                  <button type="button" onClick={copyLedgerId} className="text-muted-foreground hover:text-foreground" title="Copier">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Δ crédits</div>
                <div className="font-semibold tabular-nums text-primary">+{ledger.data.delta}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Solde après</div>
                <div className="font-semibold tabular-nums">{ledger.data.solde_apres}</div>
              </div>
              <div className="col-span-2 md:col-span-4">
                <div className="text-muted-foreground text-xs">Enregistrée le</div>
                <div>{new Date(ledger.data.at).toLocaleString()}</div>
              </div>
              {ledger.data.motif && (
                <div className="col-span-2 md:col-span-4">
                  <div className="text-muted-foreground text-xs">Motif</div>
                  <div>{ledger.data.motif}</div>
                </div>
              )}
              <div className="col-span-2 md:col-span-4">
                <Link to="/app/credits" className="text-xs underline text-primary">Voir le grand livre complet →</Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-md border border-accent/40 bg-accent/10 p-3 text-xs text-muted-foreground">
        Rappel : le règlement s'effectue par virement sur facture AGRIDATA. Aucune donnée bancaire n'est traitée par la plateforme.
      </div>
    </div>
  );
}