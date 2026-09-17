import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/agriplan/AppShell";
import { resolveOnboardingRedirect } from "@/lib/onboarding";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Les écrans d'onboarding se protègent eux-mêmes (guardOnboardingStep) ;
    // ici on ne fait qu'aiguiller vers le tunnel depuis le reste de l'app
    // (dashboard, etc.) tant qu'il n'est pas terminé. On laisse aussi passer
    // la page de pré-faisabilité (/app/projects/$id/prefaisabilite/...),
    // visitée DEPUIS l'écran Résultats du tunnel en cliquant "Pré-faisabilité"
    // / "Générer avec mon premier crédit offert".
    // Bug corrigé (2 tentatives) : on avait d'abord essayé de détecter ce cas
    // via ?onboarding=1 dans l'URL (search), mais ce garde s'exécute AVANT
    // que la route de destination ne valide ses propres search params
    // (validateSearch) — donc `location.search` ne contient jamais encore
    // cette clé à ce stade, quoi qu'on fasse côté validateSearch de la page
    // cible. On teste donc le chemin (pathname), connu et stable dès le
    // départ, plutôt qu'un search param dont la disponibilité dépend de
    // l'ordre d'exécution du router. Sans cette exception, ce garde
    // renvoyait l'utilisateur vers /onboarding/resultat SANS le contexte
    // (mode/zoneCode/projectId) qu'exige cet écran, qui le renvoyait à son
    // tour vers /onboarding/contexte — boucle en arrière à chaque choix
    // d'une recommandation, avec l'impression que le projet avait disparu.
    const isOnboardingLinked =
      location.pathname.startsWith("/onboarding") ||
      location.pathname.includes("/prefaisabilite/");

    if (!isOnboardingLinked) {
      const target = await resolveOnboardingRedirect(data.user.id);
      if (target) {
        // Un admin plateforme (profiles.platform_role = "admin") accède à
        // toute l'app sans jamais être renvoyé dans le tunnel d'onboarding,
        // quel que soit l'état d'avancement de l'organisation à laquelle son
        // compte est rattaché. On ne fait cette vérification que si une
        // redirection serait sinon déclenchée, pour ne pas ajouter de requête
        // supplémentaire au cas courant (onboarding déjà terminé).
        const { data: profile } = await supabase
          .from("profiles")
          .select("platform_role")
          .eq("id", data.user.id)
          .maybeSingle();
        if (profile?.platform_role !== "admin") {
          throw redirect({ to: target });
        }
      }
    }

    return { user: data.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});