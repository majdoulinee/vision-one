import { supabase } from "@/integrations/supabase/client";

// Ordre des étapes tel que défini par la contrainte CHECK sur organizations.onboarding_step.
export const ONBOARDING_STEPS = [
  "org_created",
  "context_done",
  "result_done",
  "project_created",
  "team_step",
  "completed",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

// À quelle route mène chaque étape une fois atteinte (= "prochain écran à afficher").
const ROUTE_FOR_STEP: Record<OnboardingStep, string | null> = {
  org_created: "/onboarding/contexte",
  context_done: "/onboarding/resultat",
  result_done: "/onboarding/projet-pret",
  project_created: "/onboarding/resultat",
  team_step: "/onboarding/equipe",
  completed: null, // parcours terminé, pas de redirection
};

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}

/**
 * Détermine si l'utilisateur courant doit être redirigé dans le tunnel d'onboarding.
 * Retourne le chemin à atteindre, ou null si rien à faire (onboarding terminé
 * ou pas de contexte applicable). Utilisable hors composant React (beforeLoad).
 */
export async function resolveOnboardingRedirect(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("org_members")
    .select("org:organizations!inner(onboarding_step)")
    .eq("user_id", userId)
    .limit(1);
  if (error) throw error;

  if (!data || data.length === 0) return "/onboarding/organisation";

  const step = (data[0] as any).org?.onboarding_step as OnboardingStep | undefined;
  if (!step) return null;

  // À partir de 'team_step', les écrans 5/6 sont accessibles via leurs propres
  // CTA (§6 "Plus tard" / §7 "Passer cette étape") mais ne doivent plus forcer
  // la redirection depuis le reste de l'app : c'est la checklist du dashboard
  // (§8) qui prend le relais pour les actions optionnelles restantes.
  if (step === "team_step" || step === "completed") return null;

  return ROUTE_FOR_STEP[step];
}

/**
 * Garde à poser en beforeLoad sur chaque écran d'onboarding : vérifie que l'org
 * courante a bien atteint le prérequis minimal pour afficher cet écran, sinon
 * renvoie l'utilisateur là où il doit réellement être (étape précédente si elle
 * manque). Ne bloque jamais un utilisateur "en avance" (ex: bouton Retour).
 */
export async function guardOnboardingStep(
  userId: string,
  requiredMinStep: OnboardingStep,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("org_members")
    .select("org:organizations!inner(id, onboarding_step)")
    .eq("user_id", userId)
    .limit(1);
  if (error) throw error;

  if (!data || data.length === 0) return "/onboarding/organisation";

  const step = (data[0] as any).org?.onboarding_step as OnboardingStep | undefined;
  if (!step) return "/onboarding/organisation";

  if (stepIndex(step) < stepIndex(requiredMinStep)) {
    return ROUTE_FOR_STEP[step] ?? "/dashboard";
  }
  return null;
}

/** Fait passer l'org courante à l'étape suivante et logue la transition dans audit_log. */
export async function advanceOnboardingStep(
  orgId: string,
  userId: string,
  step: OnboardingStep,
): Promise<void> {
  const update: any = { onboarding_step: step };
  if (step === "completed") update.onboarding_completed_at = new Date().toISOString();

  const { error } = await supabase.from("organizations").update(update).eq("id", orgId);
  if (error) throw error;

  await logOnboardingStep(orgId, userId, step);
}

/** Section 9 du doc : une ligne audit_log par transition d'écran, pour les indicateurs §10. */
export async function logOnboardingStep(
  orgId: string,
  userId: string,
  step: OnboardingStep,
): Promise<void> {
  const { error } = await supabase.from("audit_log").insert({
    org_id: orgId,
    user_id: userId,
    action: "onboarding_step",
    entity_type: "organization",
    entity_id: orgId,
    meta: { step, org_id: orgId },
  });
  // Le tracking ne doit jamais bloquer le parcours utilisateur.
  if (error) console.error("[onboarding] audit_log insert failed", error);
}
