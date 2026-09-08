import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useSession } from "@/hooks/use-session";
import { usePublishedVersion, useReferentiel } from "@/hooks/use-referentiel";
import { recommend, inverse } from "@/engines/recommendation";
import type { Orientation, Risque } from "@/engines/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { fmtHa, fmtMAD, fmtNum } from "@/lib/format";
import { ArrowRight, Compass, Wallet as WalletIcon } from "lucide-react";
import { BackButton } from "@/components/agriplan/BackButton";
import { formatError } from "@/lib/format-error";

export const Route = createFileRoute("/_authenticated/app/projects/new")({
  ssr: false,
  component: NewProjectWizard,
});

type Mode = "projet" | "capital";

function NewProjectWizard() {
  const { t } = useTranslation();
  const { current } = useCurrentOrg();
  const { user } = useSession();
  const version = usePublishedVersion();
  const ref = useReferentiel(version.data?.version);
  const nav = useNavigate();

  const [mode, setMode] = useState<Mode | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  // form state
  const [name, setName] = useState("");
  const [zoneCode, setZoneCode] = useState("");
  const [surface, setSurface] = useState<string>("");
  const [capital, setCapital] = useState<string>("");
  const [horizon, setHorizon] = useState<string>("7");
  const [orientation, setOrientation] = useState<Orientation>("export");
  const [risk, setRisk] = useState<Risque>("moyen");
  const [busy, setBusy] = useState(false);

  const zones = ref.data?.zones ?? [];

  async function submitStep1() {
    if (!current) return;
    if (!mode) return;
    if (!user) {
      toast.error(t("common.error"));
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
            <div className="sm:col-span-2">
              <Label>{t("wizard.name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("wizard.zone")}</Label>
              <Select value={zoneCode} onValueChange={setZoneCode} disabled={!version.isLoading && !version.data}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.code} value={z.code}>{z.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!version.isLoading && !version.data && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Référentiel non publié</AlertTitle>
                  <AlertDescription>
                    Le référentiel n'est pas encore publié — contactez l'administrateur de la plateforme.
                  </AlertDescription>
                </Alert>
              )}
            </div>
            {mode === "projet" ? (
              <>
                <div>
                  <Label>{t("wizard.surface")}</Label>
                  <Input type="number" step="0.1" value={surface} onChange={(e) => setSurface(e.target.value)} />
                </div>
                <div>
                  <Label>{t("wizard.capitalOpt")}</Label>
                  <Input type="number" value={capital} onChange={(e) => setCapital(e.target.value)} />
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <Label>{t("wizard.capital")}</Label>
                <Input type="number" value={capital} onChange={(e) => setCapital(e.target.value)} />
              </div>
            )}
            <div>
              <Label>{t("wizard.horizon")}</Label>
              <Input type="number" value={horizon} onChange={(e) => setHorizon(e.target.value)} />
            </div>
            <div>
              <Label>{t("wizard.orientation")}</Label>
              <Select value={orientation} onValueChange={(v) => setOrientation(v as Orientation)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="export">{t("orient.export")}</SelectItem>
                  <SelectItem value="local">{t("orient.local")}</SelectItem>
                  <SelectItem value="mixte">{t("orient.mixte")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("wizard.risk")}</Label>
              <Select value={risk} onValueChange={(v) => setRisk(v as Risque)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="faible">{t("risk.faible")}</SelectItem>
                  <SelectItem value="moyen">{t("risk.moyen")}</SelectItem>
                  <SelectItem value="eleve">{t("risk.eleve")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex items-center justify-between">
              <BackButton onClick={() => setMode(null)} label={t("wizard.back")} />
              <Button
                disabled={busy || !name || !zoneCode || (mode === "projet" ? !surface : !capital)}
                onClick={submitStep1}
              >
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