import { Link } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";

export function CreditBadge() {
  const { data } = useWallet();
  const credits = data?.credits ?? 0;
  const alerte = data?.credits_alerte ?? 3;
  const tone =
    credits === 0
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : credits <= alerte
      ? "border-accent/50 bg-accent/15 text-accent-foreground"
      : "border-border bg-card text-foreground";
  return (
    <Link
      to="/app/credits"
      title="Mes crédits"
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-semibold tabular-nums transition-colors hover:bg-accent/10 ${tone}`}
    >
      <Coins className="h-4 w-4" />
      <span>{credits}</span>
      <span className="hidden md:inline text-xs font-normal opacity-70">crédits</span>
    </Link>
  );
}