import { Badge } from "@/components/ui/badge";

type Variant = React.ComponentProps<typeof Badge>["variant"];

const PROP_MAP: Record<string, { label: string; variant: Variant }> = {
  brouillon: { label: "brouillon", variant: "line" },
  soumise: { label: "soumise", variant: "sky" },
  validee_comite: { label: "validée comité", variant: "ochre" },
  approuvee_admin: { label: "approuvée admin", variant: "ink" },
  renvoyee_comite: { label: "renvoyée", variant: "clay" },
  publiee: { label: "publiée · immuable", variant: "ochre" },
};

const LOT_MAP: Record<string, { label: string; variant: Variant }> = {
  ouvert: { label: "ouvert", variant: "line" },
  en_cours: { label: "en cours", variant: "sky" },
  gele: { label: "gelé", variant: "ochre" },
  publie: { label: "publié · immuable", variant: "ochre" },
};

const INGEST_MAP: Record<string, { label: string; variant: Variant }> = {
  a_examiner: { label: "à examiner", variant: "sky" },
  acceptee: { label: "acceptée", variant: "ink" },
  ecartee: { label: "écartée", variant: "line" },
  signalee: { label: "signalée", variant: "clay" },
  bloquee_k: { label: "bloquée · k", variant: "clay" },
};

export function PropositionStatusBadge({ statut }: { statut: string }) {
  const m = PROP_MAP[statut] ?? { label: statut, variant: "line" as Variant };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export function LotStatusBadge({ statut }: { statut: string }) {
  const m = LOT_MAP[statut] ?? { label: statut, variant: "line" as Variant };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export function IngestionStatusBadge({ statut }: { statut: string }) {
  const m = INGEST_MAP[statut] ?? { label: statut, variant: "line" as Variant };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}