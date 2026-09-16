import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { usePublishedVersion, useReferentiel } from "@/hooks/use-referentiel";
import { recommend, inverse } from "@/engines/recommendation";
import { guardOnboardingStep } from "@/lib/onboarding";
import type { Orientation, Risque } from "@/engines/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtHa, fmtMAD } from "@/lib/format";
import { BackButton } from "@/components/agriplan/BackButton";
import { OnboardingProgress } from "@/components/agriplan/OnboardingProgress";

// Champs optionnels : une redirection générique (garde d'onboarding dans
// _authenticated/route.tsx, ou un lien direct sans contexte) peut amener ici
// sans ces paramètres. On ne plante plus dans ce cas — beforeLoad renvoie
// alors vers l'écran contexte pour reconstituer la saisie.
const searchSchema = z.object({
  projectId: z.string().optional(),
  mode: z.enum(["projet", "capital"]).optional(),
  zoneCode: z.string().optional(),
  surface: z.string().optional(),
  capital: z.string().optional(),
  horizon: z.string().optional(),
  orientation: z.enum(["export", "local", "mixte"]).optional(),
  risk: z.enum(["faible", "moyen", "eleve"]).optional(),
});

export const Route = createFileRoute("/_authenticated/onboarding/resultat")({
  ssr: false,
  validateSearch: (s) => searchSchema.parse(s),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const target = await guardOnboardingStep(data.user.id, "context_done");
    if (target) throw redirect({ to: target });
    // Cet écran a besoin du contexte saisi à l'étape précédente. Si on y
    // arrive sans lui (redirection générique mal aiguillée, lien direct...),
    // on repart proprement vers l'écran contexte plutôt que de planter.
    if (!search.mode || !search.zoneCode || !search.projectId) {
      throw redirect({ to: "/onboarding/contexte" });
    }
  },
  component: OnboardingResultat,
});

function OnboardingResultat() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const { current } = useCurrentOrg();
  const version = usePublishedVersion();
  const ref = useReferentiel(version.data?.version);

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
  // Premier crédit jamais utilisé : le wallet est encore à son solde initial (3).
  const isFirstCredit = wallet.data?.credits === 3;

  const { mode, zoneCode, surface, capital, horizon, orientation, risk, projectId } = search;

  const recos = useMemo(() => {
    // beforeLoad redirige déjà si l'un de ces trois manque ; ce garde-fou ne
    // fait que protéger le typage et un éventuel rendu transitoire.
    if (!ref.data || !mode || !zoneCode) return null;
    if (mode === "projet") {
      return recommend(
        {
          zoneCode,
          superficieHa: Number(surface) || 0,
          capitalMAD: capital ? Number(capital) : null,
          horizonAns: Number(horizon),
          orientation: orientation as Orientation,
          appetenceRisque: risk as Risque,
        },
        ref.data.profils,
        ref.data.mappings,
      );
    }
    return inverse(
      {
        capitalMAD: Number(capital),
        zoneCode,
        orientation: orientation as Orientation,
        appetenceRisque: risk as Risque,
        horizonAns: Number(horizon || 8),
      },
      ref.data.profils,
      ref.data.mappings,
    );
  }, [ref.data, mode, zoneCode, surface, capital, horizon, orientation, risk]);

  // Repart vers l'écran contexte avec la saisie précédente préchargée (§5 :
  // "ne pas perdre la saisie").
  const adjustSearch = { mode, zoneCode, surface, capital, horizon, orientation, risk } as any;

  // beforeLoad redirige déjà si l'un de ces trois manque ; ce garde-fou ne
  // fait que protéger le typage (mode/projectId sont requis plus bas) et un
  // éventuel rendu transitoire avant que la redirection ne prenne effet.
  if (!mode || !zoneCode || !projectId) {
    return <div className="text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <OnboardingProgress step={3} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("wizard.results")}</h1>
          <p className="text-sm text-muted-foreground">
            {zoneCode} · {t(`orient.${orientation}`)} · {t(`risk.${risk}`)}
          </p>
        </div>
        <BackButton
          to="/onboarding/contexte"
          label={t("onboarding.resultat.adjust")}
        />
      </div>

      {!recos?.length ? (
        <p className="text-muted-foreground">{t("wizard.noResults")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recos.map((r: any) => (
            <OnboardingRecoCard
              key={r.profil.code}
              r={r}
              mode={mode}
              projectId={projectId}
              isFirstCredit={isFirstCredit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OnboardingRecoCard({
  r, mode, projectId, isFirstCredit,
}: {
  r: any;
  mode: "projet" | "capital";
  projectId: string;
  isFirstCredit: boolean;
}) {
  const { t } = useTranslation();
  const p = r.profil;
  const zoneLabel = r.statutZone === "optimal" ? "optimal" : "eligible";
  const provenance = p.provenance?.source ?? "comite_experts";
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{p.label}</CardTitle>
            <CardDescription>
              {p.culture}{p.systeme ? ` · ${p.systeme}` : ""}{p.techno ? ` · ${p.techno}` : ""}
            </CardDescription>
          </div>
          <div className="flex flex-col items-center">
            <div className="rounded-full bg-primary/10 px-3 py-1 text-xl font-bold text-primary">
              {r.score}
            </div>
            <span className="text-[10px] text-muted-foreground">/100</span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <Badge
            variant={zoneLabel === "optimal" ? "default" : "secondary"}
            className={zoneLabel === "optimal" ? "" : "bg-accent text-accent-foreground"}
          >
            {t(`mappingStatus.${zoneLabel}`)}
          </Badge>
          {p.perenne && (
            <Badge variant="outline">
              {t("misc.perennial", { n: p.annees_avant_production })}
            </Badge>
          )}
          <Badge variant="outline">{t(`provenance.${provenance}`)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Row label={t("prefa.marge") + " / ha"} v={fmtMAD(r.margeNormativeHa)} />
        <Row label="EBITDA / ha" v={fmtMAD(r.ebitdaHa)} />
        <Row label={t("wizard.capital") + " / ha"} v={fmtMAD(r.capitalRequisHa)} />
        <Row label="Invest. / ha" v={fmtMAD(r.investissementHa)} />
        {r.delaiRetourIndicatifAns != null && (
          <Row label={t("bp.payback")} v={`${r.delaiRetourIndicatifAns} ${t("bp.years")}`} />
        )}
        {mode === "capital" && (
          <>
            <Row label={t("wizard.reachableSurface")} v={fmtHa(r.superficieAtteignableHa)} />
            <Row label={t("wizard.totalBudget")} v={fmtMAD(r.budgetTotalIndicatif)} />
          </>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary" className="flex-1">
            <Link
              to="/app/projects/$id/prefaisabilite/$profilCode"
              params={{ id: projectId, profilCode: p.code }}
              search={{ generate: 0, onboarding: 1 } as any}
            >
              {t("wizard.seePrefaisa")}
            </Link>
          </Button>
          <Button asChild size="sm" className="flex-1">
            <Link
              to="/app/projects/$id/prefaisabilite/$profilCode"
              params={{ id: projectId, profilCode: p.code }}
              search={{ generate: 1, onboarding: 1 } as any}
            >
              {isFirstCredit ? t("onboarding.resultat.generateFirstCredit") : t("onboarding.resultat.generateStandard")}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
