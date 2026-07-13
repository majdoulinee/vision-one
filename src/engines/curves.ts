// Deterministic curve helpers — DO NOT modify formulas.
import type { Poste, Profil } from "./types";
import { POSTES } from "./types";

export function bell(n: number, peakAt: number, width: number, total: number) {
  const raw = Array.from({ length: n }, (_, i) =>
    Math.exp(-((i - peakAt) ** 2) / (2 * width * width)),
  );
  const s = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => Math.round((v / s) * total));
}

export function flat(n: number, total: number) {
  const w = total / n;
  return Array.from({ length: n }, () => Math.round(w));
}

export function front(n: number, span: number, total: number) {
  const a = Array(n).fill(0);
  for (let i = 0; i < span; i++) a[i] = Math.round(total / span);
  return a;
}

export const addArr = (...arrs: number[][]) =>
  Array.from({ length: arrs[0].length }, (_, i) =>
    arrs.reduce((a, x) => a + (x[i] || 0), 0),
  );

/**
 * Hydrate a compact DB profile row into the engine-ready Profil with weekly arrays.
 * The DB `data` jsonb contains totals + curve params; arrays are expanded here.
 */
export function hydrateProfil(row: { code: string; name: string; data: any }): Profil {
  const d = row.data ?? {};
  const n = d.duree_semaines ?? 40;
  const pic = d.curves?.pic ?? 22;
  const largeur = d.curves?.largeur ?? 8;
  const t = d.charges_totaux ?? {};
  const mo = t.main_oeuvre ?? 0;
  const intrants = t.intrants ?? 0;
  const irrigation = t.irrigation_eau ?? 0;
  const energie = t.energie ?? 0;
  const recolte = t.recolte_conditionnement ?? 0;
  const autres = t.autres_charges ?? 0;

  const modeledCharges: Record<Poste, number[]> = {
    main_oeuvre: addArr(front(n, 6, Math.round(mo * 0.25)), bell(n, pic, largeur, Math.round(mo * 0.75))),
    intrants: addArr(front(n, 8, Math.round(intrants * 0.45)), flat(n, Math.round(intrants * 0.55))),
    irrigation_eau: flat(n, irrigation),
    energie: flat(n, energie),
    recolte_conditionnement: bell(n, pic + 2, largeur, recolte),
    autres_charges: flat(n, autres),
  } as Record<Poste, number[]>;
  const modeledProduction = bell(n, pic + 2, largeur, 1000).map((x) => x / 1000);

  // Prefer real weekly arrays from the referential when present and well-sized.
  const isNumArrN = (a: unknown): a is number[] =>
    Array.isArray(a) && a.length === n && a.every((x) => typeof x === "number" && Number.isFinite(x));
  const ch = d.charges_hebdo;
  const chargesReal =
    ch &&
    (Object.keys(modeledCharges) as Poste[]).every((k) => isNumArrN(ch[k]));
  const charges: Record<Poste, number[]> = chargesReal
    ? {
        main_oeuvre: ch.main_oeuvre,
        intrants: ch.intrants,
        irrigation_eau: ch.irrigation_eau,
        energie: ch.energie,
        recolte_conditionnement: ch.recolte_conditionnement,
        autres_charges: ch.autres_charges,
      }
    : modeledCharges;

  const prodReal = isNumArrN(d.production_hebdo);
  const production: number[] = prodReal ? d.production_hebdo : modeledProduction;

  const norms_source: "real" | "modeled" | "mixed" =
    chargesReal && prodReal ? "real" : !chargesReal && !prodReal ? "modeled" : "mixed";

  const inv = d.invest ?? {};
  return {
    code: row.code,
    label: row.name,
    culture: d.culture ?? "",
    variete: d.variete,
    systeme: d.systeme,
    techno: d.techno,
    orientation: d.orientation ?? "export",
    risque: d.risque ?? "moyen",
    perenne: !!d.perenne,
    annees_avant_production: d.annees_avant_production ?? 0,
    duree_vie_ans: d.duree_vie_ans ?? 10,
    duree_semaines: n,
    semaine_debut_typique: d.semaine_debut_typique ?? 1,
    invest_serres: inv.serres ?? 0,
    invest_irrigation: inv.irrigation ?? 0,
    invest_plantation: inv.plantation ?? 0,
    invest_machinisme: inv.machinisme ?? 0,
    invest_total: inv.total ?? 0,
    amortissement_ans: inv.amortissement_ans ?? 10,
    rendement_kg_ha: d.rendement_kg_ha ?? 0,
    prix_export_mad_kg: d.prix_export_mad_kg ?? 0,
    prix_local_mad_kg: d.prix_local_mad_kg ?? 0,
    min_capital_mad_ha: d.min_capital_mad_ha ?? 0,
    charges,
    production,
    provenance: d.provenance,
    norms_source,
  };
}

export { POSTES };