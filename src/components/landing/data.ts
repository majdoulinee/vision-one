// Static data for the landing widgets. Client-only, deterministic.

export type ZoneKey = "Souss-Massa" | "Loukkos" | "Gharb" | "Saïss";

export type Profile = {
  code: string;
  name: string;
  investPerHa: number; // MAD/ha
  marginPerHa: number; // MAD/ha/an marge normative
  payback: number; // années
  zones: ZoneKey[];
  tag?: string;
};

export const ZONES: ZoneKey[] = ["Souss-Massa", "Loukkos", "Gharb", "Saïss"];

export const PROFILES: Profile[] = [
  { code: "AVO-HASS", name: "Avocatier Hass — 4×2 m", investPerHa: 320_000, marginPerHa: 78_000, payback: 6.2, zones: ["Souss-Massa", "Loukkos"] },
  { code: "AVO-LAMB", name: "Avocatier Lamb Hass", investPerHa: 305_000, marginPerHa: 71_000, payback: 6.8, zones: ["Souss-Massa", "Loukkos", "Gharb"] },
  { code: "MYR-BIL",  name: "Myrtille en substrat", investPerHa: 780_000, marginPerHa: 210_000, payback: 4.7, zones: ["Loukkos", "Gharb"] },
  { code: "FRA-TUN",  name: "Fraise sous tunnel", investPerHa: 240_000, marginPerHa: 96_000, payback: 3.1, zones: ["Loukkos", "Gharb"] },
  { code: "AGR-VAL",  name: "Agrumes Valencia", investPerHa: 145_000, marginPerHa: 38_000, payback: 5.9, zones: ["Souss-Massa", "Gharb", "Saïss"] },
  { code: "TOM-SER",  name: "Tomate cerise sous serre", investPerHa: 620_000, marginPerHa: 185_000, payback: 4.2, zones: ["Souss-Massa"] },
  { code: "POM-GAL",  name: "Pommier Gala", investPerHa: 210_000, marginPerHa: 54_000, payback: 6.4, zones: ["Saïss"] },
  { code: "OLI-INT",  name: "Olivier intensif", investPerHa: 95_000, marginPerHa: 22_000, payback: 7.1, zones: ["Saïss", "Gharb"] },
];

export function computeReco(capital: number, zone: ZoneKey) {
  return PROFILES
    .filter((p) => p.zones.includes(zone))
    .map((p) => {
      const ha = capital > 0 ? capital / p.investPerHa : 0;
      // score: marge annuelle projetée pondérée par capital réutilisé
      const score = Math.round(ha * p.marginPerHa);
      return { ...p, ha, score };
    })
    .sort((a, b) => b.score - a.score)
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