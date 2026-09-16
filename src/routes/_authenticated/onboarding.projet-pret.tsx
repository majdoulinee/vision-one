import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useSession } from "@/hooks/use-session";
import { advanceOnboardingStep, guardOnboardingStep } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { OnboardingProgress } from "@/components/agriplan/OnboardingProgress";
import { fmtHa, fmtMAD, fmtNum } from "@/lib/format";
import { CheckCircle2, Users, ArrowRight } from "lucide-react";

const searchSchema = z.object({
  projectId: z.string(),
  credited: z.union([z.literal(0), z.literal(1)]).optional(),
});

export const Route = createFileRoute("/_authenticated/onboarding/projet-pret")({
  ssr: false,
  validateSearch: (s) => searchSchema.parse(s),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const target = await guardOnboardingStep(data.user.id, "result_done");
    if (target) throw redirect({ to: target });
  },
  component: OnboardingProjetPret,
});

function OnboardingProjetPret() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { projectId, credited } = Route.useSearch();
  const { current } = useCurrentOrg();
  const { user } = useSession();

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, zone_code, mode, surface_ha, capital")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const wallet = useQuery({
    queryKey: ["wallet", current?.org_id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("credits")
        .eq("org_id", current!.org_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function next(destination: "/onboarding/equipe" | "/dashboard") {
    if (!current || !user) return;
    await advanceOnboardingStep(current.org_id, user.id, "team_step");
    nav({ to: destination });
  }

  if (!project.data) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <OnboardingProgress step={4} />

      <div className="text-center">
        <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("onboarding.projetPret.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("onboarding.projetPret.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{project.data.name}</CardTitle>
          <CardDescription>{project.data.zone_code}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          {project.data.mode === "projet" ? (
            <SummaryStat label={t("wizard.surface")} value={fmtHa(project.data.surface_ha)} />
          ) : (
            <SummaryStat label={t("wizard.capital")} value={fmtMAD(project.data.capital)} />
          )}
          <SummaryStat label={t("wallet.credits")} value={wallet.data ? fmtNum(wallet.data.credits) : "—"} />
        </CardContent>
      </Card>

      {credited === 1 && wallet.data && (
        <div className="rounded-lg border border-accent bg-accent/10 p-4 text-center text-sm">
          {t("onboarding.projetPret.creditUsed", { credits: wallet.data.credits })}
        </div>
      )}

      {/* §6 : deux actions de poids visuel égal, jamais une icône fermeture discrète. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" className="w-full" onClick={() => next("/onboarding/equipe")}>
          <Users className="mr-2 h-4 w-4" />
          {t("onboarding.projetPret.inviteTeam")}
        </Button>
        <Button size="lg" variant="outline" className="w-full" onClick={() => next("/dashboard")}>
          {t("onboarding.projetPret.later")}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
