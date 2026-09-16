import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useSession } from "@/hooks/use-session";
import { usePublishedVersion, useReferentiel } from "@/hooks/use-referentiel";
import { recommend, inverse } from "@/engines/recommendation";
import type { Orientation, Risque } from "@/engines/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  ProjectContextFields,
  validateProjectForm,
  type ProjectFormErrors,
} from "@/components/agriplan/ProjectContextFields";
import { fmtHa, fmtMAD, fmtNum } from "@/lib/format";
import { ArrowRight, Compass, Wallet as WalletIcon, RotateCcw } from "lucide-react";
import { BackButton } from "@/components/agriplan/BackButton";
import { formatError } from "@/lib/format-error";

// VO-15 : l'étape et les champs du tunnel sont reflétés dans l'URL
// (validateSearch + navigate({search}), sur le modèle de
// onboarding.contexte.tsx) — un rafraîchissement ou un lien partagé
// retombe exactement là où l'utilisateur en était.
const searchSchema = z.object({
  mode: z.enum(["projet", "capital"]).optional(),
  projectId: z.string().optional(),
  name: z.string().optional(),
  zoneCode: z.string().optional(),
  surface: z.string().optional(),
  capital: z.string().optional(),
  horizon: z.string().optional(),
  orientation: z.enum(["export", "local", "mixte"]).optional(),
  risk: z.enum(["faible", "moyen", "eleve"]).optional(),
});

export const Route = createFileRoute("/_authenticated/app/projects/new")({
  ssr: false,
  validateSearch: (s) => searchSchema.parse(s),
  component: NewProjectWizard,
});

type Mode = "projet" | "capital";

interface ProjectDraft {
  mode: Mode;
  name: string;
  zoneCode: string;
  surface: string;
  capital: string;
  horizon: string;
  orientation: Orientation;
  risk: Risque;
  savedAt: string;
}

function draftKey(orgId: string) {
  return `vision-one:project-draft:${orgId}`;
}

function readDraft(orgId: string): ProjectDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(orgId));
    return raw ? (JSON.parse(raw) as ProjectDraft) : null;
  } catch {
    return null;
  }
}

function writeDraft(orgId: string, draft: ProjectDraft) {
  try {
    localStorage.setItem(draftKey(orgId), JSON.stringify(draft));
  } catch {
    // localStorage indisponible (navigation privée, quota dépassé...) — non bloquant.
  }
}

function clearDraft(orgId: string) {
  try {
    localStorage.removeItem(draftKey(orgId));
  } catch {
    // idem
  }
}

function NewProjectWizard() {
  const { t } = useTranslation();
  const { current } = useCurrentOrg();
  const { user } = useSession();
  const version = usePublishedVersion();
  const ref = useReferentiel(version.data?.version);
  const nav = useNavigate();
  const search = Route.useSearch();

  const [mode, setMode] = useState<Mode | null>(search.mode ?? null);
  const [projectId, setProjectId] = useState<string | null>(search.projectId ?? null);

  // form state
  const [name, setName] = useState(search.name ?? "");
  const [zoneCode, setZoneCode] = useState(search.zoneCode ?? "");
  const [surface, setSurface] = useState<string>(search.surface ?? "");
  const [capital, setCapital] = useState<string>(search.capital ?? "");
  const [horizon, setHorizon] = useState<string>(search.horizon ?? "7");
  const [orientation, setOrientation] = useState<Orientation>(search.orientation ?? "export");
  const [risk, setRisk] = useState<Risque>(search.risk ?? "moyen");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<ProjectFormErrors>({});

  // VO-15 : brouillon local (localStorage) — proposé au chargement si un
  // brouillon existe pour cette organisation et que l'URL n'a pas déjà
  // fourni d'état (lien direct, retour arrière...).
  const [draftPrompt, setDraftPrompt] = useState<ProjectDraft | null>(null);
  const draftChecked = useRef(false);

  useEffect(() => {
    if (draftChecked.current || !current) return;
    draftChecked.current = true;
    if (search.mode) return;
    const draft = readDraft(current.org_id);
    if (draft) setDraftPrompt(draft);
  }, [current, search.mode]);

  function resumeDraft() {
    if (!draftPrompt) return;
    setMode(draftPrompt.mode);
    setName(draftPrompt.name);
    setZoneCode(draftPrompt.zoneCode);
    setSurface(draftPrompt.surface);
    setCapital(draftPrompt.capital);
    setHorizon(draftPrompt.horizon);
    setOrientation(draftPrompt.orientation);
    setRisk(draftPrompt.risk);
    setDraftPrompt(null);
  }

  function discardDraft() {
    if (current) clearDraft(current.org_id);
    setDraftPrompt(null);
  }

  const zones = ref.data?.zones ?? [];

  // VO-15 : synchronise en continu l'étape et les champs dans l'URL.
  useEffect(() => {
    nav({
      search: {
        mode: mode ?? undefined,
        projectId: projectId ?? undefined,
        name: name || undefined,
        zoneCode: zoneCode || undefined,
        surface: surface || undefined,
        capital: capital || undefined,
        horizon: horizon || undefined,
        orientation,
        risk,
      },
      replace: true,
    });
  }, [nav, mode, projectId, name, zoneCode, surface, capital, horizon, orientation, risk]);

  // VO-15 : sauvegarde locale du brouillon tant que le projet n'existe pas
  // encore côté serveur (au-delà, c'est déjà une vraie ligne `projects`).
  useEffect(() => {
    if (!current || !mode || projectId) return;
    writeDraft(current.org_id, {
      mode, name, zoneCode, surface, capital, horizon, orientation, risk,
      savedAt: new Date().toISOString(),
    });
  }, [current, mode, projectId, name, zoneCode, surface, capital, horizon, orientation, risk]);

  async function submitStep1() {
    if (!current) return;
    if (!mode) return;
    if (!user) {
      toast.error(t("common.error"));
      return;
    }
    const fieldErrors = validateProjectForm(t, mode, { name, zoneCode, surface, capital, horizon });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      toast.error(Object.values(fieldErrors)[0] as string);
      return;
    }
    setBusy(true);
    try {
      const payload: any = {
        org_id: current.org_id,
        created_by: user.id,
        name,
        mode,
        zone_code: zoneCode,
        surface_ha: mode === "projet" ? Number(surface) : null,
        capital: capital ? Number(capital) : null,
        status: "draft",
        data: {
          horizon: Number(horizon || (mode === "capital" ? 8 : 7)),
          orientation,
          risque: risk,
          ref_version: version.data?.version,
        },
      };
      const { data, error } = await supabase
        .from("projects")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      setProjectId(data.id);
      clearDraft(current.org_id);
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  const recos = useMemo(() => {
    if (!ref.data || !projectId || !mode || !zoneCode) return null;
    if (mode === "projet") {
      return recommend(
        {
          zoneCode,
          superficieHa: Number(surface) || 0,
          capitalMAD: capital ? Number(capital) : null,
          horizonAns: Number(horizon),
          orientation,
          appetenceRisque: risk,
        },
        ref.data.profils,
        ref.data.mappings,
      );
    }
    return inverse(
      {
        capitalMAD: Number(capital),
        zoneCode,
        orientation,
        appetenceRisque: risk,
        horizonAns: Number(horizon || 8),
      },
      ref.data.profils,
      ref.data.mappings,
    );
  }, [ref.data, projectId, mode, zoneCode, surface, capital, horizon, orientation, risk]);

  if (!current) return <div>{t("common.loading")}</div>;

  // --- Step 1: mode picker ---
  if (!mode) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <BackButton to="/dashboard" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{t("wizard.title")}</h1>
        {draftPrompt && (
          <Alert>
            <RotateCcw className="h-4 w-4" />
            <AlertTitle>{t("wizard.draftFoundTitle")}</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {t("wizard.draftFoundDesc", { date: new Date(draftPrompt.savedAt).toLocaleString() })}
              </span>
              <span className="flex gap-2">
                <Button size="sm" onClick={resumeDraft}>{t("wizard.draftResume")}</Button>
                <Button size="sm" variant="ghost" onClick={discardDraft}>{t("wizard.draftDiscard")}</Button>
              </span>
            </AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <ModeCard
            title={t("wizard.modeClassique")}
            desc={t("wizard.modeClassiqueDesc")}
            icon={<Compass className="h-8 w-8 text-primary" />}
            onClick={() => setMode("projet")}
          />
          <ModeCard
            title={t("wizard.modeInverse")}
            desc={t("wizard.modeInverseDesc")}
            icon={<WalletIcon className="h-8 w-8 text-primary" />}
            onClick={() => setMode("capital")}
          />
        </div>
      </div>
    );
  }

  // --- Step 2: form (before project saved) ---
  if (!projectId) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center gap-3">
          <BackButton onClick={() => setMode(null)} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {mode === "projet" ? t("wizard.modeClassique") : t("wizard.modeInverse")}
        </h1>
        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
            <ProjectContextFields
              mode={mode}
              zones={zones}
              referentielMissing={!version.isLoading && !version.data}
              values={{ name, zoneCode, surface, capital, horizon }}
              onChange={(patch) => {
                if (patch.name !== undefined) setName(patch.name);
                if (patch.zoneCode !== undefined) setZoneCode(patch.zoneCode);
                if (patch.surface !== undefined) setSurface(patch.surface);
                if (patch.capital !== undefined) setCapital(patch.capital);
                if (patch.horizon !== undefined) setHorizon(patch.horizon);
              }}
              orientation={orientation}
              onOrientationChange={setOrientation}
              risk={risk}
              onRiskChange={setRisk}
              errors={errors}
            />
            <div className="sm:col-span-2 flex items-center justify-between">
              <BackButton onClick={() => setMode(null)} label={t("wizard.back")} />
              <Button disabled={busy} onClick={submitStep1}>
                {t("wizard.next")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Step 3: results ---
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("wizard.results")}</h1>
        <p className="text-sm text-muted-foreground">
          {name} · {zoneCode} · {t(`orient.${orientation}`)} · {t(`risk.${risk}`)}
        </p>
      </div>
      {!recos?.length ? (
        <p className="text-muted-foreground">{t("wizard.noResults")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recos.map((r: any) => (
            <RecoCard
              key={r.profil.code}
              r={r}
              mode={mode}
              projectId={projectId}
              onGenerate={() =>
                nav({
                  to: "/app/projects/$id/prefaisabilite/$profilCode",
                  params: { id: projectId, profilCode: r.profil.code },
                  search: { generate: 1 } as any,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ModeCard({
  title, desc, icon, onClick,
}: { title: string; desc: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border bg-card p-6 text-start transition hover:border-primary hover:shadow"
    >
      <div className="mb-3">{icon}</div>
      <div className="text-xl font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </button>
  );
}

function RecoCard({
  r, mode, projectId,
}: {
  r: any;
  mode: Mode;
  projectId: string;
  onGenerate: () => void;
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
              search={{ generate: 0 }}
            >
              {t("wizard.seePrefaisa")}
            </Link>
          </Button>
          <Button asChild size="sm" className="flex-1">
            <Link
              to="/app/projects/$id/prefaisabilite/$profilCode"
              params={{ id: projectId, profilCode: p.code }}
              search={{ generate: 1 } as any}
            >
              {t("wizard.generate")}
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