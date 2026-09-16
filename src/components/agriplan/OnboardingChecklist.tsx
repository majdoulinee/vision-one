import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, X } from "lucide-react";

const HIDE_KEY_PREFIX = "agriplan.checklist.hidden.";

/**
 * §8 : checklist repliable/masquable affichée sur le dashboard tant que
 * l'onboarding n'est pas 'completed', ou qu'il reste des actions optionnelles
 * ouvertes. Chaque item coché disparaît ; la checklist entière disparaît une
 * fois tout fait ou explicitement masquée.
 */
export function OnboardingChecklist({
  orgId,
  onboardingStep,
}: {
  orgId: string;
  onboardingStep: string;
}) {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(HIDE_KEY_PREFIX + orgId) === "1";
  });

  const members = useQuery({
    queryKey: ["org_members_count", orgId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("org_members")
        .select("user_id", { count: "exact", head: true })
        .eq("org_id", orgId);
      if (error) throw error;
      return count ?? 1;
    },
  });

  const teamInvited = (members.data ?? 1) > 1;

  const items = [
    { id: "inviteTeam", label: t("onboarding.checklist.inviteTeam"), done: teamInvited, to: "/settings" as const },
    { id: "discoverReferentiel", label: t("onboarding.checklist.discoverReferentiel"), done: false, to: "/app/referentiel" as const },
  ];
  const remaining = items.filter((i) => !i.done);

  const shouldShow = !hidden && (onboardingStep !== "completed" || remaining.length > 0);
  if (!shouldShow) return null;

  function hide() {
    window.localStorage.setItem(HIDE_KEY_PREFIX + orgId, "1");
    setHidden(true);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{t("onboarding.checklist.title")}</CardTitle>
        <Button variant="ghost" size="sm" onClick={hide}>
          <X className="mr-1.5 h-3.5 w-3.5" />
          {t("onboarding.checklist.hide")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) =>
          item.done ? null : (
            <Link
              key={item.id}
              to={item.to}
              className="flex items-center gap-2 rounded-md p-2 text-sm transition hover:bg-muted"
            >
              <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{item.label}</span>
            </Link>
          ),
        )}
        {items
          .filter((i) => i.done)
          .map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-md p-2 text-sm text-muted-foreground line-through">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              <span>{item.label}</span>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
