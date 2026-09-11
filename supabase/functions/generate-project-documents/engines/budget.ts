// B.2 — Campaign budget engine. DO NOT modify formulas.
// Mirror of src/engines/budget.ts — see types.ts header note.
import type { BudgetInput, Override, Profil, Semaine } from "./types.ts";
import { POSTES } from "./types.ts";

function getOv(ovs: Override[] | undefined, cle: string, def: any) {
  const o = (ovs || []).find((x) => x.cle === cle);
  return o ? (o.valeur as any) : def;
}

export function computeBudget({
  profil,
  superficieHa,
  campagne,
  orientation = "export",
  overrides = [],
  anneeProduction = null,
}: BudgetInput) {
  const ha = getOv(overrides, "superficieHa", superficieHa) as number;
  const rendement = getOv(overrides, "rendementKgHa", profil.rendement_kg_ha) as number;
  const prixDef =
    orientation === "local" ? profil.prix_local_mad_kg : profil.prix_export_mad_kg;
  const prix = getOv(overrides, "prixVenteMADKg", prixDef) as number;
  const semaineDebut = getOv(
    overrides,
    "semaineDebut",
    profil.semaine_debut_typique,
  ) as number;
  const n = profil.duree_semaines;

  let prodFactor = 1;
  let chargeFactor = 1;
  if (profil.perenne && anneeProduction != null) {
    const a = anneeProduction;
    const a0 = profil.annees_avant_production;
    prodFactor = a <= a0 ? 0 : Math.min(1, (a - a0) / 3);
    chargeFactor = a <= a0 ? 0.5 : 0.7 + 0.3 * prodFactor;
  }

  const semaines: Semaine[] = [];
  let cumul = 0;
  for (let i = 0; i < n; i++) {
    const chg: Record<string, number> = {};
    let totalChg = 0;
    for (const poste of POSTES) {
      const coef = getOv(overrides, "coef." + poste, 1) as number;
      const v = Math.round(
        (profil.charges[poste][i] || 0) * ha * coef * chargeFactor,
      );
      chg[poste] = v;
      totalChg += v;
    }
    const kg = Math.round(profil.production[i] * rendement * ha * prodFactor);
    const recette = Math.round(kg * prix);
    cumul += recette - totalChg;
    semaines.push({
      ordre: i + 1,
      semaineCalendaire: ((semaineDebut - 1 + i) % 52) + 1,
      charges: chg,
      totalCharges: totalChg,
      productionKg: kg,
      recettes: recette,
      fluxNet: recette - totalChg,
      tresorerieCumulee: cumul,
    });
  }

  const totaux: any = { parPoste: {}, charges: 0, recettes: 0, productionKg: 0 };
  for (const poste of POSTES)
    totaux.parPoste[poste] = semaines.reduce((a, s) => a + s.charges[poste], 0);
  totaux.charges = semaines.reduce((a, s) => a + s.totalCharges, 0);
  totaux.recettes = semaines.reduce((a, s) => a + s.recettes, 0);
  totaux.productionKg = semaines.reduce((a, s) => a + s.productionKg, 0);
  totaux.margeCampagne = totaux.recettes - totaux.charges;
  totaux.coutParHa = ha ? Math.round(totaux.charges / ha) : 0;
  totaux.coutParKg = totaux.productionKg
    ? +(totaux.charges / totaux.productionKg).toFixed(2)
    : null;
  totaux.besoinTresorerieMax = Math.min(
    0,
    ...semaines.map((s) => s.tresorerieCumulee),
  );

  return {
    profilCode: profil.code,
    profilLabel: profil.label,
    campagne,
    superficieHa: ha,
    hypotheses: {
      rendementKgHa: rendement,
      prixVenteMADKg: prix,
      orientation,
      semaineDebut,
      prodFactor,
      chargeFactor,
    },
    semaines,
    totaux,
    overrides,
    anneeProduction,
  };
}

export function reforecast(
  budgetDoc: any,
  profil: Profil,
  newOverrides: { cle: string; valeur: any }[],
  auteur: string,
) {
  const merged: Override[] = [...((budgetDoc.overrides as Override[]) || [])];
  for (const ov of newOverrides) {
    const prev = merged.find((x) => x.cle === ov.cle);
    const origine = prev ? prev.valeurOrigine : defaultFor(profil, budgetDoc, ov.cle);
    const entry: Override = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(Date.now()) + Math.random(),
      cle: ov.cle,
      valeur: ov.valeur,
      valeurOrigine: origine ?? null,
      auteur,
      date: new Date().toISOString(),
    };
    const i = merged.findIndex((x) => x.cle === ov.cle);
    if (i >= 0) merged[i] = entry;
    else merged.push(entry);
  }
  return computeBudget({
    profil,
    superficieHa: budgetDoc.superficieHa,
    campagne: budgetDoc.campagne,
    orientation: budgetDoc.hypotheses.orientation,
    overrides: merged,
    anneeProduction: budgetDoc.anneeProduction ?? null,
  });
}

function defaultFor(profil: Profil, doc: any, cle: string) {
  if (cle === "rendementKgHa") return profil.rendement_kg_ha;
  if (cle === "prixVenteMADKg")
    return doc.hypotheses.orientation === "local"
      ? profil.prix_local_mad_kg
      : profil.prix_export_mad_kg;
  if (cle === "superficieHa") return doc.superficieHa;
  if (cle === "semaineDebut") return profil.semaine_debut_typique;
  if (cle.startsWith("coef.")) return 1;
  return null;
}
