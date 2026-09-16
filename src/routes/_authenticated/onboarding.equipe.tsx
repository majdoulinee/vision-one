import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useSession } from "@/hooks/use-session";
import { advanceOnboardingStep, guardOnboardingStep } from "@/lib/onboarding";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InviteMemberForm } from "@/components/agriplan/InviteMemberForm";
import { OnboardingProgress } from "@/components/agriplan/OnboardingProgress";

export const Route = createFileRoute("/_authenticated/onboarding/equipe")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const target = await guardOnboardingStep(data.user.id, "team_step");
    if (target) throw redirect({ to: target });
  },
  component: OnboardingEquipe,
});

function OnboardingEquipe() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { current } = useCurrentOrg();
  const { user } = useSession();

  async function complete() {
    if (!current || !user) return;
    await advanceOnboardingStep(current.org_id, user.id, "completed");
    nav({ to: "/dashboard" });
  }

  if (!current) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <OnboardingProgress step={5} />
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("onboarding.equipe.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("onboarding.equipe.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.invite")}</CardTitle>
          <CardDescription>{t("settings.role")}: member / viewer</CardDescription>
        </CardHeader>
        <CardContent>
          <InviteMemberForm
            orgId={current.org_id}
            allowedRoles={["member", "viewer"]}
            defaultRole="member"
            submitLabel={t("onboarding.equipe.sendAndContinue")}
            onSent={complete}
          />
        </CardContent>
      </Card>

      <div className="text-center">
        <Button variant="link" onClick={complete}>
          {t("onboarding.equipe.skip")}
        </Button>
      </div>
    </div>
  );
}
