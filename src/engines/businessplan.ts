// B.3 — Business plan engine. DO NOT modify formulas.
import type { BPInput, Override } from "./types";
import { computeBudget } from "./budget";

export const SCENARIOS = {
  conservateur: { rendement: 0.85, prix: 0.9 },
  base: { rendement: 1.0, prix: 1.0 },
  optimiste: { rendement: 1.1, prix: 1.08 },
} as const;

export function irr(flows: number[]): number | null {
  let lo = -0.9;
  let hi = 3;
  const npvAt = (r: number) =>
    flows.reduce((a, f, t) => a + f / Math.pow(1 + r, t), 0);
  if (npvAt(lo) * npvAt(hi) > 0) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (npvAt(lo) * npvAt(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return +(((lo + hi) / 2) * 100).toFixed(1);
}

export function computeBusinessPlan({
  profil,
  superficieHa,
  horizonAns,
  orientation = "export",
  tauxActualisation = 0.1,
  partDette = 0.5,
  tauxDette = 0.065,
  dureeDetteAns = 7,
  overrides = [],
  anneeDepart = 2026,
}: BPInput) {
  const invest = profil.invest_total * superficieHa;
  const amortAnnuel = invest / profil.amortissement_ans;
  const dette = invest * partDette;
  const annuite =
    dette > 0 ? dette * (tauxDette / (1 - Math.pow(1 + tauxDette, -dureeDetteAns))) : 0;

  const scenarios: any = {};
  for (const [nom, f] of Object.entries(SCENARIOS)) {
    const baseRend =
      (overrides.find((o) => o.cle === "rendementKgHa")?.valeur as number) ??
      profil.rendement_kg_ha;
    const basePrix =
      (overrides.find((o) => o.cle === "prixVenteMADKg")?.valeur as number) ??
      (orientation === "local" ? profil.prix_local_mad_kg : profil.prix_export_mad_kg);
    const ovs: Override[] = [
      ...overrides,
      {
        cle: "rendementKgHa",
        valeur: Math.round(baseRend * f.rendement),
        auteur: "scenario:" + nom,
        date: null,
        valeurOrigine: profil.rendement_kg_ha,
      },
      {
        cle: "prixVenteMADKg",
        valeur: +(basePrix * f.prix).toFixed(2),
        auteur: "scenario:" + nom,
        date: null,
        valeurOrigine: null,
      },
    ];

    const annees: any[] = [];
    const flux: number[] = [-invest * (1 - partDette)];
    let cumulCash = -invest * (1 - partDette);
    let payback: number | null = null;

    for (let a = 1; a <= horizonAns; a++) {
      const b = computeBudget({
        profil,
        superficieHa,
        campagne: `${anneeDepart + a - 1}-${(anneeDepart + a) % 100}`,
        orientation,
        overrides: ovs,
        anneeProduction: profil.perenne ? a : null,
      });
      const ca = b.totaux.recettes;
      const opex = b.totaux.charges;
      const enPhaseInvest = profil.perenne && a <= profil.annees_avant_production;
      const chargesExploit = enPhaseInvest ? 0 : opex;
      const capitalise = enPhaseInvest ? opex : 0;
      const ebitda = ca - chargesExploit;
      annees.push({
        annee: anneeDepart + a - 1,
        campagne: b.campagne,
        ca,
        opex,
        capitalise,
        ebitda,
        productionKg: b.totaux.productionKg,
      });
    }

    const actifBio = annees.reduce((s, y) => s + y.capitalise, 0);
    const dureeAmortBio = Math.max(
      1,
      (profil.duree_vie_ans || 10) - profil.annees_avant_production,
    );
    for (const y of annees) {
      const idx = y.annee - anneeDepart + 1;
      const enProd = !profil.perenne || idx > profil.annees_avant_production;
      y.amortissement = Math.round(
        amortAnnuel + (profil.perenne && enProd ? actifBio / dureeAmortBio : 0),
      );
      y.serviceDette = idx <= dureeDetteAns ? Math.round(annuite) : 0;
      y.resultat = Math.round(
        y.ebitda -
          y.amortissement -
          (idx <= dureeDetteAns ? y.serviceDette * 0.4 : 0),
      );
      y.bfr = Math.round(y.opex * 0.12);
      y.cashFlow = Math.round(y.ebitda - y.serviceDette - y.capitalise);
      cumulCash += y.cashFlow;
      y.cashCumule = Math.round(cumulCash);
      if (payback === null && cumulCash >= 0) payback = idx;
      flux.push(y.cashFlow);
    }

    const van = Math.round(
      flux.reduce((a2, f2, t) => a2 + f2 / Math.pow(1 + tauxActualisation, t), 0),
    );
    const caTot = annees.reduce((s, y) => s + y.ca, 0);
    const kg = annees.reduce((s, y) => s + y.productionKg, 0);
    const op = annees.reduce((s, y) => s + y.opex, 0);
    const prixMoyen = kg ? caTot / kg : 0;

    scenarios[nom] = {
      annees,
      actifBiologique: actifBio,
      indicateurs: {
        van,
        tri: irr(flux),
        paybackAns: payback,
        coutParHaMoyen: Math.round(op / horizonAns / superficieHa),
        coutParKgMoyen: kg ? +(op / kg).toFixed(2) : null,
        pointMortKgAn: prixMoyen ? Math.round(op / horizonAns / prixMoyen) : null,
      },
    };
  }

  return {
    profilCode: profil.code,
    profilLabel: profil.label,
    superficieHa,
    horizonAns,
    orientation,
    planInvestissement: {
      detailHa: {
        serres: profil.invest_serres,
        irrigation: profil.invest_irrigation,
        plantation: profil.invest_plantation,
        machinisme: profil.invest_machinisme,
        total: profil.invest_total,
        amortissementAns: profil.amortissement_ans,
      },
      totalMAD: invest,
      financement: {
        fondsPropres: Math.round(invest * (1 - partDette)),
        dette: Math.round(dette),
        tauxDette,
        dureeDetteAns,
        annuite: Math.round(annuite),
      },
    },
    hypothesesFinancieres: { tauxActualisation, partDette },
    scenarios,
    overrides,
  };
}