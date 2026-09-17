import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePublishedVersion, useReferentiel } from "@/hooks/use-referentiel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/agriplan/BackButton";
import { fmtDate, fmtHa, fmtMAD } from "@/lib/format";
import { Sparkles, FileText, Wallet } from "lucide-react";
import type { ReactNode } from "react";

// Page de détails d'un projet (VO — "voir le choix choisi et les détails du
// projet" depuis le tableau de bord). Volontairement placée sous
// app.projects.$id.details.tsx plutôt que app.projects.$id.tsx : ce dernier
// nom existerait déjà comme préfixe de app.projects.$id.prefaisabilite.$profilCode.tsx
// et deviendrait alors automatiquement son layout parent dans l'arbre de
// routes généré par TanStack Router (cf. app.admin.users.tsx /
// app.admin.users.$id.tsx, qui suivent ce même schéma) — il faudrait alors y
// ajouter un <Outlet /> pour ne pas casser la page de pré-faisabilité. En
// choisissant un segment "details" indépendant, cette page reste une route
// feuille isolée, sans aucun risque pour le tunnel de pré-faisabilité déjà
// corrigé.
export const Route = createFileRoute("/_authenticated/app/projects/$id/details")({
  ssr: false,
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const { t } = useTranslation();

  const project = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const docs = useQuery({
    queryKey: ["project-docs", id],
    queryFn: async () => {
      const [{ data: budgets }, { data: bps }] = await Promise.all([
        supabase.from("budgets").select("id").eq("project_id", id).maybeSingle(),
        supabase.from("business_plans").select("id").eq("project_id", id).maybeSingle(),
      ]);
      return { budgetId: budgets?.id ?? null, bpId: bps?.id ?? null };
    },
  });

  const projData = (project.data?.data ?? {}) as Record<string, any>;
  const publishedVersion = usePublishedVersion();
  const ref = useReferentiel(projData.ref_version ?? publishedVersion.data?.version);

  const profil = project.data?.profile_code
    ? ref.data?.profils.find((pr) => pr.code === project.data!.profile_code)
    : undefined;
  const zoneLabel =
    ref.data?.zones.find((z) => z.code === project.data?.zone_code)?.label ?? project.data?.zone_code;

  if (project.isLoading) {
    return <div className="text-muted-foreground">{t("common.loading")}</div>;
  }
  if (project.error || !project.data) {
    return (
      <div className="space-y-4">
        <BackButton to="/dashboard" />
        <p className="text-muted-foreground">{t("projectDetail.notFound")}</p>
      </div>
    );
  }

  const p = project.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackButton to="/dashboard" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{p.name}</h1>
          <p className="text-muted-foreground">
            {zoneLabel} · {t("projects.created")} {fmtDate(p.created_at)}
          </p>
        </div>
        <Badge variant={p.status === "genere" ? "default" : "secondary"}>
          {p.status === "genere" ? t("projectDetail.statusGenere") : t("projectDetail.statusDraft")}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("projectDetail.context")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("projectDetail.mode")}
            value={p.mode === "projet" ? t("wizard.modeClassique") : t("wizard.modeInverse")}
          />
          <Field label={t("wizard.zone")} value={zoneLabel ?? "—"} />
          {p.mode === "projet" && <Field label={t("wizard.surface")} value={fmtHa(p.surface_ha)} />}
          <Field label={t("wizard.capital")} value={p.capital != null ? fmtMAD(Number(p.capital)) : "—"} />
          <Field
            label={t("wizard.horizon")}
            value={projData.horizon ? `${projData.horizon} ${t("bp.years")}` : "—"}
          />
          <Field
            label={t("wizard.orientation")}
            value={projData.orientation ? t(`orient.${projData.orientation}`) : "—"}
          />
          <Field label={t("wizard.risk")} value={projData.risque ? t(`risk.${projData.risque}`) : "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("projectDetail.chosenProfile")}</CardTitle>
        </CardHeader>
        <CardContent>
          {profil ? (
            <div className="space-y-4">
              <div>
                <div className="text-lg font-semibold">{profil.label}</div>
                <div className="text-sm text-muted-foreground">{profil.culture}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {profil.perenne && (
                    <Badge variant="outline">
                      {t("misc.perennial", { n: profil.annees_avant_production })}
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {t(`provenance.${(profil.provenance as any)?.source ?? "comite_experts"}`)}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {docs.data?.budgetId && (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/app/budgets/$id" params={{ id: docs.data.budgetId }}>
                      <Wallet className="mr-2 h-4 w-4" /> {t("projectDetail.viewBudget")}
                    </Link>
                  </Button>
                )}
                {docs.data?.bpId && (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/app/business-plans/$id" params={{ id: docs.data.bpId }}>
                      <FileText className="mr-2 h-4 w-4" /> {t("projectDetail.viewBp")}
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">{t("projectDetail.noProfileYet")}</p>
              <p className="max-w-sm text-sm text-muted-foreground">{t("projectDetail.noProfileYetDesc")}</p>
              <Button asChild size="sm" className="mt-2">
                <Link
                  to="/app/projects/new"
                  search={{
                    mode: p.mode as "projet" | "capital",
                    projectId: p.id,
                    name: p.name,
                    zoneCode: p.zone_code ?? undefined,
                    surface: p.surface_ha != null ? String(p.surface_ha) : undefined,
                    capital: p.capital != null ? String(p.capital) : undefined,
                    horizon: projData.horizon != null ? String(projData.horizon) : undefined,
                    orientation: projData.orientation,
                    risk: projData.risque,
                  }}
                >
                  {t("projectDetail.resume")}
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
