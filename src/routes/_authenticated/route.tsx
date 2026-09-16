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
      if (target) throw redirect({ to: target });
    }

    return { user: data.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});