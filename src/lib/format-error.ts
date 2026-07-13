/**
 * Robustly extract a human-readable message from any thrown value —
 * including Supabase PostgrestError objects (which are plain objects,
 * not Error instances, so `String(e)` yields "[object Object]").
 */
export function formatError(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object") {
    const obj = e as Record<string, unknown>;
    const msg =
      (typeof obj.message === "string" && obj.message) ||
      (typeof obj.error_description === "string" && obj.error_description) ||
      (typeof obj.error === "string" && obj.error) ||
      (typeof obj.hint === "string" && obj.hint) ||
      (typeof obj.details === "string" && obj.details);
    if (msg) return msg;
    try {
      return JSON.stringify(e);
    } catch {
      return "Erreur inconnue";
    }
  }
  return String(e);
}