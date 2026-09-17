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
  // Bug corrigé : pointait vers "/onboarding/resultat" (retour en arrière dans
  // le tunnel), qui exige mode/zoneCode/horizon/orientation/risk en paramètres
  // obligatoires — la redirection générique (_authenticated/route.tsx) n'a
  // jamais ce contexte, donc ça plantait à chaque navigation une fois l'étape
  // "project_created" atteinte. L'écran suivant logique est bien "équipe".
  project_created: "/onboarding/equipe",
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

  // Bug corrigé : cette condition ne coupait la redirection forcée qu'à
  // partir de 'team_step'. Or dès l'écran Résultats ('context_done'), les
  // boutons "Pré-faisabilité" / "Générer" envoient volontairement
  // l'utilisateur hors du tunnel (/app/projects/.../prefaisabilite/...,
  // /app/credits pour "Demander des crédits" en cas de solde insuffisant,
  // etc.) — une "porte de sortie" assumée du parcours linéaire. Comme rien
  // ne fait jamais progresser onboarding_step au-delà de 'context_done'
  // pour un utilisateur qui emprunte cette sortie (les étapes 'result_done'
  // et 'project_created' ne sont en pratique jamais atteintes), ce garde le
  // renvoyait ensuite en boucle vers /onboarding/resultat sans contexte, qui
  // le renvoyait à son tour vers /onboarding/contexte, dès la moindre
  // navigation ultérieure (ex: clic sur "Demander des crédits").
  // Dès qu'un projet existe ('context_done' ou au-delà), l'utilisateur a de
  // quoi utiliser l'app (org, wallet, premier projet) : on arrête de forcer
  // la redirection généraliste, et c'est la checklist du dashboard (§8) qui
  // prend le relais pour les étapes optionnelles restantes (équipe...).
  // Seule l'étape 'org_created' (organisation créée mais aucun projet/
  // contexte encore saisi) force encore la redirection vers
  // /onboarding/contexte.
  if (step !== "org_created") return null;

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
