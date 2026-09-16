import { useTranslation } from "react-i18next";

/**
 * Barre de progression partagée par les écrans /onboarding/* (spec §9 :
 * "Étape X sur 5" en en-tête de chaque écran, écrans 2 à 6).
 */
export function OnboardingProgress({ step }: { step: 1 | 2 | 3 | 4 | 5 }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto mb-6 max-w-2xl">
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{t("onboarding.stepOf", { n: step })}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(step / 5) * 100}%` }}
        />
      </div>
    </div>
  );
}
