import { useConsultantLinksForClient } from "@/hooks/use-consultant-links";
import { AlertTriangle, HelpCircle, Loader2, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCurrentOrg } from "@/hooks/use-current-org";

type LinkRow = {
  id: string;
  role: string;
  statut: string;
  accorde_le: string;
  revoque_le?: string | null;
  motif_revocation?: string | null;
  consultant_org?: { name?: string } | null;
};

function StatusLegend() {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label="Que signifient ces statuts ?"
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <HelpCircle className="h-3.5 w-3.5" /> Statuts
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 text-xs space-y-2">
        <div className="font-semibold text-sm">Cycle de vie du rattachement</div>
        <ul className="space-y-1.5">
          <li>
            <span className="inline-block rounded bg-primary/10 text-primary px-1.5 py-0.5 mr-1">actif</span>
            Le cabinet peut opérer sur votre organisation selon son rôle (opérateur / lecteur).
          </li>
          <li>
            <span className="inline-block rounded bg-accent/20 text-foreground px-1.5 py-0.5 mr-1">en_attente</span>
            Rattachement proposé par un administrateur ; en attente de confirmation.
          </li>
          <li>
            <span className="inline-block rounded bg-destructive/10 text-destructive px-1.5 py-0.5 mr-1">revoque</span>
            L'accès a été retiré. Le lien reste dans l'historique (audit) mais est inopérant.
          </li>
        </ul>
        <div className="pt-1 text-[11px] text-muted-foreground">
          Flux : proposé → <b>en_attente</b> → accordé (<b>actif</b>) → <b>revoque</b>. La demande de révocation peut être faite depuis « Gérer ».
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Frame({
  tone = "accent",
  icon,
  children,
}: {
  tone?: "accent" | "muted" | "destructive";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === "destructive"
      ? "border-destructive/50 bg-destructive/5"
      : tone === "muted"
        ? "border-border bg-muted/40"
        : "border-accent/60 bg-accent/10";
  return (
    <div className={`rounded-md border ${cls} px-4 py-2 text-sm flex flex-wrap items-center gap-3`}>
      <span className="shrink-0">{icon}</span>
      <div className="flex-1 min-w-0 space-y-0.5">{children}</div>
      <div className="flex items-center gap-2">
        <StatusLegend />
        <a href="/settings" className="text-xs underline">Gérer</a>
      </div>
    </div>
  );
}

export function ConsultantBanner() {
  const { currentId } = useCurrentOrg();
  const { data, isLoading, isError, error } = useConsultantLinksForClient();

  // No org selected yet — do not surface anything.
  if (!currentId) return null;

  if (isLoading) {
    return (
      <Frame tone="muted" icon={<Loader2 className="h-4 w-4 animate-spin" />}>
        <span className="text-muted-foreground">Chargement du statut consultant…</span>
      </Frame>
    );
  }

  if (isError) {
    return (
      <Frame tone="destructive" icon={<AlertTriangle className="h-4 w-4 text-destructive" />}>
        <div>
          <strong>Données indisponibles.</strong>{" "}
          <span className="text-muted-foreground">
            Impossible de récupérer les rattachements consultant
            {error instanceof Error && error.message ? ` : ${error.message}` : ""}.
          </span>
        </div>
      </Frame>
    );
  }

  const links = (data ?? []) as LinkRow[];
  const active = links.filter((l) => l.statut === "actif");
  const pending = links.filter((l) => l.statut === "en_attente");
  const revoked = links.filter((l) => l.statut === "revoque");

  // Empty state — aucun profil consultant rattaché.
  if (active.length === 0 && pending.length === 0) {
    return (
      <Frame tone="muted" icon={<Users className="h-4 w-4 text-muted-foreground" />}>
        <div className="text-muted-foreground">
          Aucun cabinet consultant n'est rattaché à votre organisation.
          {revoked.length > 0 && (
            <span className="ml-1 text-[11px]">
              ({revoked.length} rattachement{revoked.length > 1 ? "s" : ""} révoqué{revoked.length > 1 ? "s" : ""} dans l'historique)
            </span>
          )}
        </div>
      </Frame>
    );
  }

  return (
    <Frame tone="accent" icon={<Users className="h-4 w-4" />}>
      {active.map((l) => (
        <div key={l.id}>
          Le cabinet <strong>{l.consultant_org?.name ?? "—"}</strong> a accès à votre organisation (
          <span className="font-medium">{l.role}</span>), accordé le{" "}
          {new Date(l.accorde_le).toLocaleDateString()}.{" "}
          <span className="inline-block rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[11px] align-middle">
            actif
          </span>
        </div>
      ))}
      {pending.map((l) => (
        <div key={l.id}>
          Rattachement proposé pour <strong>{l.consultant_org?.name ?? "—"}</strong> (
          <span className="font-medium">{l.role}</span>).{" "}
          <span className="inline-block rounded bg-accent/30 text-foreground px-1.5 py-0.5 text-[11px] align-middle">
            en_attente
          </span>
        </div>
      ))}
    </Frame>
  );
}
