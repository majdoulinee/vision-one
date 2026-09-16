import i18n from "@/lib/i18n";

export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n == null || !isFinite(n as number)) return "—";
  return new Intl.NumberFormat(i18n.language || "fr", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(n);
}

export function fmtMAD(n: number | null | undefined): string {
  if (n == null || !isFinite(n as number)) return "—";
  return fmtNum(Math.round(n)) + " MAD";
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !isFinite(n as number)) return "—";
  return fmtNum(n, digits) + " %";
}

export function fmtKg(n: number | null | undefined): string {
  if (n == null) return "—";
  return fmtNum(n) + " kg";
}

export function fmtHa(n: number | null | undefined): string {
  if (n == null) return "—";
  return fmtNum(n, 1) + " ha";
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat(i18n.language || "fr", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(d));
  } catch {
    return d;
  }
}

// VO-21 : le pays d'une organisation est stocké en code ISO 3166-1 alpha-2
// (ex. "MA") mais était affiché brut dans l'UI. On le traduit dans la langue
// courante via Intl.DisplayNames, avec repli sur le code lui-même si ce
// n'est pas un code ISO reconnu (anciennes données en texte libre).
export function fmtCountry(code: string | null | undefined, locale?: string): string {
  if (!code) return "—";
  const lang = locale ?? i18n.language ?? "fr";
  if (!/^[A-Za-z]{2}$/.test(code)) return code;
  try {
    const dn = new Intl.DisplayNames([lang, "fr"], { type: "region" });
    return dn.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}