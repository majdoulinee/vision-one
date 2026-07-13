import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtNum } from "@/lib/format";
import { usePublishedVersion } from "@/hooks/use-referentiel";
import { PlusCircle, Wallet, ShieldCheck } from "lucide-react";

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

const COUNTER_EXPERTISE_TYPES = ["banque", "assureur", "organisme_public", "groupe"];

function Dashboard() {
  const { t } = useTranslation();
  const { orgs, current, isLoading } = useCurrentOrg();
  const version = usePublishedVersion();
  const orgId = current?.org_id;

  const projects = useQuery({
    queryKey: ["projects", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [{ data: prj, error }, { data: budgets }, { data: bps }] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name, zone_code, profile_code, mode, surface_ha, capital, created_at")
          .eq("org_id", orgId!)
          .order("created_at", { ascending: false }),
        supabase.from("budgets").select("id, project_id").eq("org_id", orgId!),
        supabase.from("business_plans").select("id, project_id").eq("org_id", orgId!),
      ]);
      if (error) throw error;
      const bMap = new Map((budgets ?? []).map((b: any) => [b.project_id, b.id]));
      const pMap = new Map((bps ?? []).map((b: any) => [b.project_id, b.id]));
      return (prj ?? []).map((p: any) => ({
        ...p,
        budgetId: bMap.get(p.id) ?? null,
        bpId: pMap.get(p.id) ?? null,
      }));
    },
  });

  const wallet = useQuery({
    queryKey: ["wallet", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("credits, plan")
        .eq("org_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  if (orgs.length === 0) return <CreateFirstOrg />;

  const showCE = current && COUNTER_EXPERTISE_TYPES.includes(current.org.type);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.title")}</h1>
          {current && (
            <p className="text-muted-foreground">
              {current.org.name} · {t(`orgType.${current.org.type}`)}
            </p>
          )}
        </div>
        <Button asChild>
          <Link to="/app/projects/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            {t("projects.new")}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" /> {t("wallet.credits")}
            </CardDescription>
            <CardTitle className="text-3xl">
              {wallet.data ? fmtNum(wallet.data.credits) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("projects.refPublished")}</CardDescription>
            <CardTitle className="text-2xl">{version.data?.version ?? "—"}</CardTitle>
            {version.data?.notes && (
              <p className="text-xs text-muted-foreground">{version.data.notes}</p>
            )}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("projects.list")}</CardDescription>
            <CardTitle className="text-3xl">
              {projects.data ? fmtNum(projects.data.length) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("projects.list")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!projects.data?.length ? (
            <p className="text-sm text-muted-foreground">{t("projects.empty")}</p>
          ) : (
            <div className="divide-y">
              {projects.data.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.zone_code} · {t("projects.created")} {fmtDate(p.created_at)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {p.budgetId && <Badge variant="secondary">{t("projects.budgetOk")}</Badge>}
                    {p.bpId && <Badge variant="secondary">{t("projects.bpOk")}</Badge>}
                    {p.budgetId && (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/app/budgets/$id" params={{ id: p.budgetId }}>Budget</Link>
                      </Button>
                    )}
                    {p.bpId && (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/app/business-plans/$id" params={{ id: p.bpId }}>BP</Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showCE && (
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> {t("projects.contreExpertise")}
            </CardTitle>
            <CardDescription>{t("projects.contreExpertiseDesc")}</CardDescription>
          </CardHeader>
        </Card>
      )}
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