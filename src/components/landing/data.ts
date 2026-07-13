// Static data for the landing widgets. Client-only, deterministic.

export type ZoneKey = "Souss-Massa" | "Loukkos" | "Gharb" | "Saïss";

export type Profile = {
  name: string;
  inv: number;    // MAD/ha
  marge: number;  // marge normative en %
  pb: number;     // payback en années
  zones: ZoneKey[];
};

export const ZONES: ZoneKey[] = ["Souss-Massa", "Loukkos", "Gharb", "Saïss"];

// Catalogue littéral du HTML de référence (mode inversé).
export const PROFILES: Profile[] = [
  { name: "Myrtille sous serre",  inv: 820_000, marge: 38, pb: 4.1, zones: ["Souss-Massa", "Loukkos", "Gharb"] },
  { name: "Framboise hors-sol",   inv: 640_000, marge: 31, pb: 3.4, zones: ["Loukkos", "Gharb"] },
  { name: "Tomate cerise serre",  inv: 410_000, marge: 24, pb: 2.8, zones: ["Souss-Massa"] },
  { name: "Avocat Hass",          inv: 520_000, marge: 34, pb: 6.2, zones: ["Gharb", "Loukkos"] },
  { name: "Agrume Maroc-Late",    inv: 300_000, marge: 21, pb: 5.5, zones: ["Souss-Massa", "Saïss", "Gharb"] },
  { name: "Poivron sous serre",   inv: 355_000, marge: 19, pb: 2.4, zones: ["Souss-Massa"] },
  { name: "Olivier intensif",     inv: 180_000, marge: 17, pb: 5.0, zones: ["Saïss"] },
  { name: "Fraise plein champ",   inv: 240_000, marge: 22, pb: 2.1, zones: ["Loukkos", "Gharb"] },
];

export function computeReco(capital: number, zone: ZoneKey) {
  return PROFILES
    .filter((p) => p.zones.includes(zone))
    .map((p) => ({ ...p, ha: capital > 0 ? capital / p.inv : 0 }))
    .filter((p) => p.ha >= 0.5)
    .sort((a, b) => b.marge / b.pb - a.marge / a.pb)
    .slice(0, 3);
}

// 52 semaines — courbe de charge : préparation, plantation, pic récolte
export const WEEK_BARS: { h: number; kind: "base" | "peak" | "cash" }[] = Array.from({ length: 52 }, (_, i) => {
  const w = i + 1;
  let h = 12; // baseline
  let kind: "base" | "peak" | "cash" = "base";
  if (w >= 1 && w <= 6) h = 18 + w * 2;            // préparation
  else if (w >= 7 && w <= 17) h = 22 + (w - 6) * 1.5; // développement
  else if (w >= 18 && w <= 22) { h = 62 + (w - 17) * 4; kind = "cash"; } // plantation cash-heavy
  else if (w >= 23 && w <= 28) h = 44 - (w - 23) * 2;
  else if (w >= 29 && w <= 34) { h = 70 + Math.sin((w - 28) / 6 * Math.PI) * 26; kind = "peak"; } // pic récolte
  else if (w >= 35 && w <= 44) h = 48 - (w - 34) * 2;
  else h = Math.max(10, 26 - (w - 44) * 1.6);
  return { h: Math.max(6, Math.min(100, Math.round(h))), kind };
});

export const GAPS = [
  { assumption: "Rendement (kg/ha)", declared: "38 000", norm: "31 200", sample: "N=142", severity: "hi" as const, score: "−22%" },
  { assumption: "Prix de vente (MAD/kg)", declared: "14,50", norm: "12,80", sample: "N=88", severity: "md" as const, score: "+13%" },
  { assumption: "Main-d'œuvre (h/ha/an)", declared: "1 480", norm: "1 520", sample: "N=142", severity: "ok" as const, score: "−3%" },
  { assumption: "Coût intrants (MAD/ha)", declared: "42 000", norm: "48 500", sample: "N=118", severity: "md" as const, score: "−13%" },
  { assumption: "TRI projeté", declared: "24%", norm: "17%", sample: "modèle", severity: "hi" as const, score: "+7 pts" },
];