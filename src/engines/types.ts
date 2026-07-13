// Domain types for AGRIPLAN calculation engines.
// These are decoupled from database row shapes; a hydrator maps DB rows to these.

export const POSTES = [
  "main_oeuvre",
  "intrants",
  "irrigation_eau",
  "energie",
  "recolte_conditionnement",
  "autres_charges",
] as const;
export type Poste = (typeof POSTES)[number];

export type Orientation = "export" | "local" | "mixte";
export type Risque = "faible" | "moyen" | "eleve";
export type MappingStatut = "optimal" | "eligible" | "exclu";

export interface Profil {
  code: string;
  label: string;
  culture: string;
  variete?: string;
  systeme?: string;
  techno?: string;
  orientation: Orientation;
  risque: Risque;
  perenne: boolean;
  annees_avant_production: number;
  duree_vie_ans: number;
  duree_semaines: number;
  semaine_debut_typique: number;
  invest_serres: number;
  invest_irrigation: number;
  invest_plantation: number;
  invest_machinisme: number;
  invest_total: number;
  amortissement_ans: number;
  rendement_kg_ha: number;
  prix_export_mad_kg: number;
  prix_local_mad_kg: number;
  min_capital_mad_ha: number;
  charges: Record<Poste, number[]>;
  production: number[]; // parts hebdo, somme ≈ 1
  provenance?: unknown;
  /** Source of weekly arrays: "real" (imported), "modeled" (generated from curves+totals), "mixed" (partial). UI-only, not read by formulas. */
  norms_source?: "real" | "modeled" | "mixed";
}

export interface Mapping {
  profil_code: string;
  zone_code: string;
  statut: MappingStatut;
}

export interface Zone {
  code: string;
  label: string;
  bbox_lng_min: number;
  bbox_lat_min: number;
  bbox_lng_max: number;
  bbox_lat_max: number;
}

export interface Override {
  id?: string;
  cle: string;
  valeur: number | string;
  valeurOrigine?: number | string | null;
  auteur?: string;
  date?: string | null;
}

export interface RecoInput {
  zoneCode: string;
  superficieHa: number | null;
  capitalMAD: number | null;
  horizonAns?: number;
  orientation?: Orientation;
  appetenceRisque?: Risque;
}

export interface InverseInput {
  capitalMAD: number;
  zoneCode: string;
  orientation?: Orientation;
  appetenceRisque?: Risque;
  horizonAns?: number;
}

export interface Reco {
  profil: Profil;
  statutZone: MappingStatut;
  score: number;
  investissementHa: number;
  capitalRequisHa: number;
  superficieRetenueHa: number;
  margeNormativeHa: number;
  ebitdaHa: number;
  caHa: number;
  delaiRetourIndicatifAns: number | null;
}

export interface BudgetInput {
  profil: Profil;
  superficieHa: number;
  campagne: string;
  orientation?: Orientation;
  overrides?: Override[];
  anneeProduction?: number | null;
}

export interface Semaine {
  ordre: number;
  semaineCalendaire: number;
  charges: Record<string, number>;
  totalCharges: number;
  productionKg: number;
  recettes: number;
  fluxNet: number;
  tresorerieCumulee: number;
}

export interface BPInput {
  profil: Profil;
  superficieHa: number;
  horizonAns: number;
  orientation?: Orientation;
  tauxActualisation?: number;
  partDette?: number;
  tauxDette?: number;
  dureeDetteAns?: number;
  overrides?: Override[];
  anneeDepart?: number;
}