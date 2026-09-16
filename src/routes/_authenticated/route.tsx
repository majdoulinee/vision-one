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
    // (dashboard, etc.) tant qu'il n'est pas terminé.
    if (!location.pathname.startsWith("/onboarding")) {
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