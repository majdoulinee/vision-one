import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { advanceOnboardingStep } from "@/lib/onboarding";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { OnboardingProgress } from "@/components/agriplan/OnboardingProgress";
import { toast } from "sonner";
import { formatError } from "@/lib/format-error";
import {
  TrendingUp,
  Sprout,
  Briefcase,
  Users,
  Landmark,
  ShieldCheck,
  Building2,
  type LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding/organisation")({
  ssr: false,
  component: OnboardingOrganisation,
});

// 7 types au choix (spec §3) — valeurs déjà présentes dans l'enum org_type
// (ajoutées par la migration 3b5e37f8_enum_alignment).
const ORG_TYPES = [
  { value: "investisseur", icon: TrendingUp },
  { value: "agriculteur", icon: Sprout },
  { value: "consultant", icon: Briefcase },
  { value: "groupe", icon: Users },
  { value: "banque", icon: Landmark },
  { value: "assureur", icon: ShieldCheck },
  { value: "organisme_public", icon: Building2 },
] as const satisfies ReadonlyArray<{ value: string; icon: LucideIcon }>;

type OrgTypeValue = (typeof ORG_TYPES)[number]["value"];

function OnboardingOrganisation() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useSession();

  const [type, setType] = useState<OrgTypeValue | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user || !type || !name.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("organizations")
        .insert({ name: name.trim(), type, created_by: user.id })
        .select("id")
        .single();
      if (error) throw error;

      // organizations a un trigger (on_organization_created) qui crée
      // automatiquement org_members(owner) + wallets(free, 3 crédits).
      await advanceOnboardingStep(data.id, user.id, "org_created");
      await qc.invalidateQueries({ queryKey: ["my-orgs"] });

      nav({ to: "/onboarding/contexte" });
    } catch (err) {
      toast.error(formatError(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <OnboardingProgress step={1} />
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("onboarding.org.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("onboarding.org.subtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ORG_TYPES.map(({ value, icon: Icon }) => {
          const selected = type === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              className={
                "flex flex-col items-start gap-2 rounded-lg border p-4 text-start transition hover:border-primary hover:shadow " +
                (selected ? "border-primary bg-primary/5 shadow" : "border-border bg-card")
              }
            >
              <Icon className={"h-6 w-6 " + (selected ? "text-primary" : "text-muted-foreground")} />
              <div className="font-semibold">{t(`orgType.${value}`)}</div>
              <p className="text-xs text-muted-foreground">{t(`onboarding.org.typeDesc.${value}`)}</p>
            </button>
          );
        })}
      </div>

      {type && (
        <Card className="mx-auto max-w-md p-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="onboardingOrgName">{t("onboarding.org.nameLabel")}</Label>
              <Input
                id="onboardingOrgName"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("onboarding.org.namePlaceholder")}
              />
            </div>
            <Button className="w-full" disabled={busy || !name.trim()} onClick={submit}>
              {t("onboarding.org.submit")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
