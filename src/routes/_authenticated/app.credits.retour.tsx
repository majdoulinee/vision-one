import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

// Page de retour après le paiement en ligne ChariPay (accept / decline URLs
// passées à la création de la session, cf app.credits.tsx / PayOnlineDialog
// et l'Edge Function charipay-create-session).
//
// Important : cette page ne fait QUE refléter l'état de la ligne
// payment_sessions (via un polling léger) — elle ne crédite jamais elle-même
// le wallet. La redirection navigateur n'est qu'une indication ; seule la
// confirmation webhook signée (Edge Function charipay-webhook) fait foi et
// met la ligne à "payee", cf doc ChariPay : "the result reaches you by
// webhook, and it's the source of truth, never the browser redirect."

export const Route = createFileRoute("/_authenticated/app/credits/retour")({
  ssr: false,
  component: PaymentReturnPage,
  validateSearch: (search: Record<string, unknown>) => ({
    session: typeof search.session === "string" ? search.session : undefined,
    result: typeof search.result === "string" ? search.result : undefined,
  }),
});

function PaymentReturnPage() {
  const { session: sessionId, result } = Route.useSearch();

  const q = useQuery({
    queryKey: ["payment_session_retour", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_sessions")
        .select("id, statut, credits, pack, montant_mad")
        .eq("id", sessionId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    // La confirmation ChariPay arrive par webhook, en général en quelques
    // secondes — on réinterroge tant que le statut est encore "en_attente".
    refetchInterval: (query) => (query.state.data?.statut === "en_attente" ? 2500 : false),
  });

  const statut = q.data?.statut;
  const enAttente = !statut || statut === "en_attente";

  return (
    <div className="max-w-lg mx-auto py-16 space-y-6">
      {!sessionId && (
        <p className="text-center text-muted-foreground">Session de paiement introuvable.</p>
      )}
      {sessionId && (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mb-2">
              {statut === "payee" && <CheckCircle2 className="h-10 w-10 text-primary" />}
              {statut === "echouee" && <XCircle className="h-10 w-10 text-destructive" />}
              {enAttente && <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />}
            </div>
            <CardTitle>
              {statut === "payee" && "Paiement confirmé"}
              {statut === "echouee" && "Paiement échoué"}
              {enAttente && "Confirmation en cours…"}
            </CardTitle>
            <CardDescription>
              {statut === "payee" && q.data && (
                <>{q.data.credits} crédits ont été ajoutés à votre solde (pack {q.data.pack}).</>
              )}
              {statut === "echouee" && "Le paiement n'a pas abouti. Aucun crédit n'a été débité."}
              {enAttente &&
                (result === "cancel"
                  ? "Paiement annulé ou interrompu côté ChariPay. Si vous avez bien payé, la confirmation peut prendre quelques instants."
                  : "La confirmation ChariPay (webhook signé) peut prendre quelques secondes.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link to="/app/credits">Retour à mes crédits</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
