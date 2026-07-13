import { Link } from "@tanstack/react-router";
import { AlertTriangle, Coins } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";

export function LowCreditBanner() {
  const { data } = useWallet();
  if (!data) return null;
  const { credits, credits_alerte } = data;
  const threshold = credits_alerte ?? 3;
  if (credits > threshold) return null;

  const empty = credits === 0;
  const tone = empty
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : "border-accent/50 bg-accent/15 text-accent-foreground";

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm ${tone}`}>
      <div className="flex items-start gap-2">
        {empty ? <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> : <Coins className="h-4 w-4 mt-0.5 shrink-0" />}
        <div>
          <strong>
            {empty
              ? "Solde de crédits épuisé."
              : `Solde bas : ${credits} crédit${credits > 1 ? "s" : ""} restant${credits > 1 ? "s" : ""}.`}
          </strong>{" "}
          <span className="opacity-80">
            {empty
              ? "Demandez un pack pour continuer à générer des documents."
              : `Seuil d'alerte : ${threshold}. Anticipez votre prochaine demande.`}
          </span>
        </div>
      </div>
      <Link
        to="/app/credits"
        className="inline-flex items-center gap-1.5 rounded-md border border-current px-3 py-1.5 text-xs font-semibold hover:bg-background/40"
      >
        <Coins className="h-3.5 w-3.5" />
        Voir mes crédits
      </Link>
    </div>
  );
}