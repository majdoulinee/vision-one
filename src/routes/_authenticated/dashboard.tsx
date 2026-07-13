import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentOrg, useMyOrganizations } from "@/hooks/use-current-org";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const ORG_TYPES = [
  "ferme",
  "cooperative",
  "banque",
  "assureur",
  "organisme_public",
  "groupe",
  "autre",
] as const;

function Dashboard() {
  const { t } = useTranslation();
  const { orgs, current, isLoading } = useCurrentOrg();

  if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  if (orgs.length === 0) return <CreateFirstOrg />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        {current && (
          <p className="text-muted-foreground">
            {current.org.name} · {t(`orgType.${current.org.type}`)}
          </p>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("nav.projects")}</CardTitle>
          <CardDescription>{t("dashboard.empty")}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function CreateFirstOrg() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof ORG_TYPES)[number]>("ferme");
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("organizations")
        .insert({ name, type, country: country || null, created_by: user.id });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["my-orgs"] });
      toast.success("Organisation créée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>{t("auth.orgSetup")}</CardTitle>
          <CardDescription>{t("app.tagline")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="orgName">{t("auth.orgName")}</Label>
              <Input id="orgName" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>{t("auth.orgType")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORG_TYPES.map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(`orgType.${k}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="country">{t("auth.country")}</Label>
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Maroc, Tunisie, Sénégal..."
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {t("auth.create")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}