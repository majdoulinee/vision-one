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