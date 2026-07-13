export function CreditStatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    en_attente: "border-accent/50 bg-accent/10 text-accent-foreground",
    accordee: "border-primary/40 bg-primary/10 text-primary",
    refusee: "border-destructive/40 bg-destructive/10 text-destructive",
  };
  const label: Record<string, string> = {
    en_attente: "En attente",
    accordee: "Accordée",
    refusee: "Refusée",
  };
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs ${map[s] ?? ""}`}>
      {label[s] ?? s}
    </span>
  );
}