import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useSession } from "@/hooks/use-session";
import { usePublishedVersion, useReferentiel } from "@/hooks/use-referentiel";
import type { Orientation, Risque } from "@/engines/types";
import { advanceOnboardingStep, guardOnboardingStep } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ProjectContextFields,
  validateProjectForm,
  type ProjectFormErrors,
} from "@/components/agriplan/ProjectContextFields";
import { ArrowRight, Compass, Wallet as WalletIcon } from "lucide-react";
import { BackButton } from "@/components/agriplan/BackButton";
import { OnboardingProgress } from "@/components/agriplan/OnboardingProgress";
import { formatError } from "@/lib/format-error";

// Tous les champs sont optionnels : ils ne sont fournis que quand on revient
// ici via "Ajuster mes paramètres" depuis l'écran résultat (§5), pour
// précharger la saisie précédente sans la perdre.
const searchSchema = z.object({
  mode: z.enum(["projet", "capital"]).optional(),
  name: z.string().optional(),
  zoneCode: z.string().optional(),
  surface: z.string().optional(),
  capital: z.string().optional(),
  horizon: z.string().optional(),
  orientation: z.enum(["export", "local", "mixte"]).optional(),
  risk: z.enum(["faible", "moyen", "eleve"]).optional(),
});

export const Route = createFileRoute("/_authenticated/onboarding/contexte")({
  ssr: false,
  validateSearch: (s) => searchSchema.parse(s),
  // Protège l'écran (§2) : impossible d'y accéder sans org déjà créée.
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const target = await guardOnboardingStep(data.user.id, "org_created");
    if (target) throw redirect({ to: target });
  },
  component: OnboardingContexte,
});

type Mode = "projet" | "capital";

function OnboardingContexte() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const search = Route.useSearch();
  const { current } = useCurrentOrg();
  const { user } = useSession();
  const version = usePublishedVersion();
  const ref = useReferentiel(version.data?.version);

  const [mode, setMode] = useState<Mode | null>(search.mode ?? null);
  const [name, setName] = useState(search.name ?? "");
  const [zoneCode, setZoneCode] = useState(search.zoneCode ?? "");
  const [surface, setSurface] = useState(search.surface ?? "");
  const [capital, setCapital] = useState(search.capital ?? "");
  // Valeurs par défaut (§4) pour qu'un utilisateur pressé valide sans tout renseigner.
  const [horizon, setHorizon] = useState(search.horizon ?? "7");
  const [orientation, setOrientation] = useState<Orientation>(search.orientation ?? "export");
  const [risk, setRisk] = useState<Risque>(search.risk ?? "moyen");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<ProjectFormErrors>({});

  const zones = ref.data?.zones ?? [];

  async function submit() {
    if (!current || !mode || !user) return;
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
        name: name || t("wizard.title"),
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
      const { data, error } = await supabase.from("projects").insert(payload).select("id").single();
      if (error) throw error;

      await advanceOnboardingStep(current.org_id, user.id, "context_done");

      nav({
        to: "/onboarding/resultat",
        search: {
          projectId: data.id,
          mode,
          zoneCode,
          surface,
          capital,
          horizon,
          orientation,
          risk,
        } as any,
      });
    } catch (e) {
      toast.error(formatError(e));
      setBusy(false);
    }
  }

  if (!current) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  // --- Choix du mode (classique / inversé), identique au wizard existant ---
  if (!mode) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <OnboardingProgress step={2} />
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("onboarding.contexte.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("onboarding.contexte.subtitle")}</p>
        </div>
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

  // --- Formulaire ---
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <OnboardingProgress step={2} />
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {mode === "projet" ? t("wizard.modeClassique") : t("wizard.modeInverse")}
        </h1>
      </div>
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
            <BackButton onClick={() => setMode(null)} label={t("onboarding.back")} />
            <Button disabled={busy} onClick={submit}>
              {t("wizard.next")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
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
