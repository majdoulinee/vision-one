import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Map as MapIcon, List as ListIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Orientation, Risque } from "@/engines/types";
import { ZoneMapPicker, type ZoneOption } from "@/components/agriplan/ZoneMapPicker";

/**
 * Champs du formulaire "contexte projet", partagés entre le tunnel de
 * création classique (/app/projects/new) et l'onboarding (/onboarding/contexte).
 * VO-16 : un seul composant pour que les deux parcours ne divergent plus sur
 * les libellés ou les bornes de saisie.
 */

export type ProjectFormMode = "projet" | "capital";

export const HORIZON_MIN = 5;
export const HORIZON_MAX = 10;

export interface ProjectFormValues {
  name: string;
  zoneCode: string;
  surface: string;
  capital: string;
  horizon: string;
}

export type ProjectFormErrors = Partial<
  Record<"name" | "zone" | "surface" | "capital" | "horizon", string>
>;

export function validateProjectForm(
  t: (key: string, opts?: any) => string,
  mode: ProjectFormMode,
  values: ProjectFormValues,
): ProjectFormErrors {
  const errors: ProjectFormErrors = {};
  if (!values.name.trim()) errors.name = t("wizard.err.name");
  if (!values.zoneCode) errors.zone = t("wizard.err.zone");

  if (mode === "projet") {
    const s = Number(values.surface);
    if (!values.surface || !(s > 0)) errors.surface = t("wizard.err.surface");
    if (values.capital !== "" && Number(values.capital) < 0) {
      errors.capital = t("wizard.err.capitalNegative");
    }
  } else {
    const c = Number(values.capital);
    if (!values.capital || !(c > 0)) errors.capital = t("wizard.err.capitalRequired");
  }

  const h = Number(values.horizon);
  if (!values.horizon || h < HORIZON_MIN || h > HORIZON_MAX) {
    errors.horizon = t("wizard.err.horizon", { min: HORIZON_MIN, max: HORIZON_MAX });
  }

  return errors;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-destructive">{message}</p>;
}

export function ProjectContextFields({
  mode,
  zones,
  referentielMissing,
  values,
  onChange,
  orientation,
  onOrientationChange,
  risk,
  onRiskChange,
  errors,
}: {
  mode: ProjectFormMode;
  zones: ZoneOption[];
  referentielMissing: boolean;
  values: ProjectFormValues;
  onChange: (patch: Partial<ProjectFormValues>) => void;
  orientation: Orientation;
  onOrientationChange: (v: Orientation) => void;
  risk: Risque;
  onRiskChange: (v: Risque) => void;
  errors: ProjectFormErrors;
}) {
  const { t } = useTranslation();
  const [showMap, setShowMap] = useState(false);
  const zonesWithBbox = useMemo(
    () =>
      zones.filter(
        (z) =>
          typeof z.bbox_lng_min === "number" &&
          typeof z.bbox_lat_min === "number" &&
          typeof z.bbox_lng_max === "number" &&
          typeof z.bbox_lat_max === "number",
      ),
    [zones],
  );

  return (
    <>
      <div className="sm:col-span-2">
        <Label htmlFor="wizard-name">{t("wizard.name")}</Label>
        <Input
          id="wizard-name"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          aria-invalid={!!errors.name}
        />
        <FieldError message={errors.name} />
      </div>

      <div className="sm:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="wizard-zone">{t("wizard.zone")}</Label>
          {zonesWithBbox.length > 0 && (
            <button
              type="button"
              onClick={() => setShowMap((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              aria-pressed={showMap}
            >
              {showMap ? <ListIcon className="h-3.5 w-3.5" /> : <MapIcon className="h-3.5 w-3.5" />}
              {showMap ? t("wizard.viewList") : t("wizard.viewMap")}
            </button>
          )}
        </div>
        <Select
          value={values.zoneCode}
          onValueChange={(v) => onChange({ zoneCode: v })}
          disabled={referentielMissing}
        >
          <SelectTrigger id="wizard-zone"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {zones.map((z) => (
              <SelectItem key={z.code} value={z.code}>{z.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showMap && (
          <div className="mt-2">
            <ZoneMapPicker
              zones={zonesWithBbox}
              value={values.zoneCode}
              onChange={(code) => onChange({ zoneCode: code })}
            />
          </div>
        )}
        <FieldError message={errors.zone} />
        {referentielMissing && (
          <Alert variant="destructive" className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t("wizard.refMissingTitle")}</AlertTitle>
            <AlertDescription>
              {t("wizard.refMissingDesc")}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {mode === "projet" ? (
        <>
          <div>
            <Label htmlFor="wizard-surface">{t("wizard.surface")}</Label>
            <Input
              id="wizard-surface"
              type="number"
              step="0.1"
              min="0.1"
              value={values.surface}
              onChange={(e) => onChange({ surface: e.target.value })}
              aria-invalid={!!errors.surface}
            />
            <FieldError message={errors.surface} />
          </div>
          <div>
            <Label htmlFor="wizard-capital">
              {t("wizard.capital")}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                · {t("common.optional")}
              </span>
            </Label>
            <Input
              id="wizard-capital"
              type="number"
              min="0"
              value={values.capital}
              onChange={(e) => onChange({ capital: e.target.value })}
              aria-invalid={!!errors.capital}
            />
            <FieldError message={errors.capital} />
          </div>
        </>
      ) : (
        <div className="sm:col-span-2">
          <Label htmlFor="wizard-capital">{t("wizard.capital")}</Label>
          <Input
            id="wizard-capital"
            type="number"
            min="0.01"
            value={values.capital}
            onChange={(e) => onChange({ capital: e.target.value })}
            aria-invalid={!!errors.capital}
          />
          <FieldError message={errors.capital} />
        </div>
      )}

      <div>
        <Label htmlFor="wizard-horizon">{t("wizard.horizon")}</Label>
        <Input
          id="wizard-horizon"
          type="number"
          min={HORIZON_MIN}
          max={HORIZON_MAX}
          value={values.horizon}
          onChange={(e) => onChange({ horizon: e.target.value })}
          aria-invalid={!!errors.horizon}
        />
        <FieldError message={errors.horizon} />
      </div>

      <div>
        <Label htmlFor="wizard-orientation">{t("wizard.orientation")}</Label>
        <Select value={orientation} onValueChange={(v) => onOrientationChange(v as Orientation)}>
          <SelectTrigger id="wizard-orientation"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="export">{t("orient.export")}</SelectItem>
            <SelectItem value="local">{t("orient.local")}</SelectItem>
            <SelectItem value="mixte">{t("orient.mixte")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="wizard-risk">{t("wizard.risk")}</Label>
        <Select value={risk} onValueChange={(v) => onRiskChange(v as Risque)}>
          <SelectTrigger id="wizard-risk"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="faible">{t("risk.faible")}</SelectItem>
            <SelectItem value="moyen">{t("risk.moyen")}</SelectItem>
            <SelectItem value="eleve">{t("risk.eleve")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
