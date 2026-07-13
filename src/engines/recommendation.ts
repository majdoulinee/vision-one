// B.1 — Recommendation engine. DO NOT modify score formulas.
import type {
  InverseInput,
  Mapping,
  Profil,
  Reco,
  RecoInput,
  Zone,
} from "./types";
import { POSTES } from "./types";

export const RISK_ORDER: Record<string, number> = { faible: 0, moyen: 1, eleve: 2 };
export { POSTES };

export function margeNormativeHa(p: Profil, orientation: "export" | "local") {
  const prix = orientation === "local" ? p.prix_local_mad_kg : p.prix_export_mad_kg;
  const ca = p.rendement_kg_ha * prix;
  const opex = POSTES.reduce(
    (a, poste) => a + p.charges[poste].reduce((x, y) => x + y, 0),
    0,
  );
  const amort = p.invest_total / p.amortissement_ans;
  return { ca, opex, amort, ebitda: ca - opex, marge: ca - opex - amort };
}

export function recommend(
  inp: RecoInput,
  profils: Profil[],
  mappings: Mapping[],
): Reco[] {
  const {
    zoneCode,
    superficieHa,
    capitalMAD,
    horizonAns = 7,
    orientation = "export",
    appetenceRisque = "moyen",
  } = inp;
  const out: Reco[] = [];
  for (const p of profils) {
    const map = mappings.find(
      (m) => m.profil_code === p.code && m.zone_code === zoneCode,
    );
    // Compat : anciennes valeurs 'possible' / 'deconseille' + valeurs spec 'eligible' / 'exclu'
    const rawStatut = (map?.statut ?? "exclu") as string;
    const statut =
      rawStatut === "deconseille" || rawStatut === "exclu"
        ? "exclu"
        : rawStatut === "optimal"
          ? "optimal"
          : "eligible";
    if (statut === "exclu") continue;
    const eco = margeNormativeHa(
      p,
      p.orientation === "local" ? "local" : (orientation as "export" | "local"),
    );
    const capitalRequisHa = p.min_capital_mad_ha;
    const haMax = capitalMAD
      ? Math.floor((capitalMAD / capitalRequisHa) * 10) / 10
      : superficieHa;
    const haRetenu = Math.min(
      (superficieHa || haMax) as number,
      (haMax || superficieHa) as number,
    );
    if (!haRetenu || haRetenu <= 0) continue;
    if (p.perenne && horizonAns < p.annees_avant_production + 2) continue;

    let score = 0;
    score += statut === "optimal" ? 40 : 22;
    score += Math.min(30, Math.max(0, (eco.marge / capitalRequisHa) * 100));
    score += orientation === p.orientation || orientation === "mixte" ? 15 : 5;
    const dr = Math.abs(RISK_ORDER[p.risque] - RISK_ORDER[appetenceRisque]);
    score += dr === 0 ? 15 : dr === 1 ? 8 : 0;

    const delaiRetourAns =
      eco.marge > 0
        ? Math.ceil(capitalRequisHa / eco.ebitda) +
          (p.perenne ? p.annees_avant_production : 0)
        : null;

    out.push({
      profil: p,
      statutZone: statut,
      score: Math.round(score),
      investissementHa: p.invest_total,
      capitalRequisHa,
      superficieRetenueHa: haRetenu,
      margeNormativeHa: Math.round(eco.marge),
      ebitdaHa: Math.round(eco.ebitda),
      caHa: Math.round(eco.ca),
      delaiRetourIndicatifAns: delaiRetourAns,
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 5);
}

export function inverse(
  {
    capitalMAD,
    zoneCode,
    orientation = "export",
    appetenceRisque = "moyen",
    horizonAns = 8,
  }: InverseInput,
  profils: Profil[],
  mappings: Mapping[],
) {
  const recos = recommend(
    {
      zoneCode,
      capitalMAD,
      superficieHa: null,
      horizonAns,
      orientation,
      appetenceRisque,
    },
    profils,
    mappings,
  );
  return recos
    .map((r) => {
      const haAtteignable = Math.floor((capitalMAD / r.capitalRequisHa) * 10) / 10;
      return {
        ...r,
        superficieAtteignableHa: haAtteignable,
        budgetTotalIndicatif: Math.round(
          Math.min(capitalMAD, r.capitalRequisHa * haAtteignable),
        ),
      };
    })
    .filter((r) => r.superficieAtteignableHa >= 0.5);
}

export function resolveZone(lat: number, lng: number, zones: Zone[]) {
  return (
    zones.find(
      (z) =>
        lng >= z.bbox_lng_min &&
        lat >= z.bbox_lat_min &&
        lng <= z.bbox_lng_max &&
        lat <= z.bbox_lat_max,
    ) || null
  );
}