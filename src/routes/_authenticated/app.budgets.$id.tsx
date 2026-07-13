import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useReferentiel } from "@/hooks/use-referentiel";
import { reforecast } from "@/engines/budget";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import { fmtMAD, fmtNum } from "@/lib/format";
import { toast } from "sonner";
import { RotateCcw, Sliders, FileDown, Copy } from "lucide-react";
import { exportVerifiablePdf } from "@/lib/pdf-export";

export const Route = createFileRoute("/_authenticated/app/budgets/$id")({
  ssr: false,
  component: BudgetPage,
});

function BudgetPage() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { current } = useCurrentOrg();
  const canEdit = current?.role === "owner" || current?.role === "admin" || current?.role === "editor";

  const budget = useQuery({
    queryKey: ["budget", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("budgets").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const ref = useReferentiel(budget.data?.ref_version);

  const project = useQuery({
    queryKey: ["project-of-budget", budget.data?.project_id],
    enabled: !!budget.data?.project_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects").select("name, zone_code")
        .eq("id", budget.data!.project_id as string).single();
      if (error) throw error;
      return data;
    },
  });

  const doc = budget.data?.data as any;
  const profil = useMemo(
    () => ref.data?.profils.find((p) => p.code === doc?.profilCode),
    [ref.data, doc?.profilCode],
  );

  const [rend, setRend] = useState<string>("");
  const [prix, setPrix] = useState<string>("");
  const [swk, setSwk] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [exported, setExported] = useState<{ docId: string; sha256: string; verifyUrl: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  if (!doc || !profil) return <div>{t("common.loading")}</div>;

  const overrides = ((budget.data?.overrides ?? []) as any[]) as any[];

  async function doExport() {
    if (!profil || !current || !budget.data || !project.data) return;
    setExporting(true);
    try {
      const res = await exportVerifiablePdf({
        kind: "budget",
        orgId: current.org_id,
        sourceId: id,
        refVersion: budget.data.ref_version ?? "unknown",
        profil,
        project: { name: project.data.name, zone_code: project.data.zone_code ?? "" },
        budget: doc,
      });
      setExported({ docId: res.docId, sha256: res.sha256, verifyUrl: res.verifyUrl });
      toast.success(t("export.success"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  async function applyReforecast() {
    if (!profil || !current) return;
    const changes: { cle: string; valeur: any }[] = [];
    if (rend) changes.push({ cle: "rendementKgHa", valeur: Number(rend) });
    if (prix) changes.push({ cle: "prixVenteMADKg", valeur: Number(prix) });
    if (swk) changes.push({ cle: "semaineDebut", valeur: Number(swk) });
    if (!changes.length) return;
    setBusy(true);
    try {
      const { data: udata } = await supabase.auth.getUser();
      const authorEmail = udata.user?.email ?? udata.user?.id ?? "?";
      const next = reforecast({ ...doc, overrides }, profil as any, changes, authorEmail);
      const { error } = await supabase
        .from("budgets")
        .update({ data: next as any, overrides: next.overrides as any })
        .eq("id", id);
      if (error) throw error;
      await supabase.from("audit_log").insert({
        org_id: current.org_id,
        action: "reforecast_budget",
        entity_type: "budget",
        entity_id: id,
        meta: { changes },
      });
      setRend(""); setPrix(""); setSwk("");
      toast.success("OK");
      qc.invalidateQueries({ queryKey: ["budget", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function restore(cle: string) {
    if (!profil || !current) return;
    const rest = overrides.filter((o) => o.cle !== cle);
    // Recompute without that override by feeding a stripped doc
    const stripped = { ...doc, overrides: rest };
    const next = reforecast(stripped, profil as any, [], "restore");
    // But reforecast merges; ensure the override is gone
    next.overrides = next.overrides.filter((o: any) => o.cle !== cle);
    const { error } = await supabase
      .from("budgets")
      .update({ data: next as any, overrides: next.overrides as any })
      .eq("id", id);
    if (error) return toast.error(error.message);
    await supabase.from("audit_log").insert({
      org_id: current.org_id,
      action: "restore_override",
      entity_type: "budget",
      entity_id: id,
      meta: { cle },
    });
    qc.invalidateQueries({ queryKey: ["budget", id] });
  }

  const T = doc.totaux;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("budget.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {doc.profilLabel} · {t("budget.campagne")} {doc.campagne} · {doc.superficieHa} ha ·{" "}
            {t("budget.refVersion")} {budget.data?.ref_version}
          </p>
          {overrides.length > 0 && (
            <Badge variant="secondary" className="mt-2 bg-accent text-accent-foreground">
              {t("budget.forcedBadge", { count: overrides.length })}
            </Badge>
          )}
          <div className="mt-2">
            {profil.norms_source === "real" ? (
              <Badge className="bg-primary text-primary-foreground">Normes réelles</Badge>
            ) : profil.norms_source === "mixed" ? (
              <Badge variant="secondary">Normes partielles</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">Normes modélisées</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={doExport} disabled={exporting || !project.data}>
            <FileDown className="mr-2 h-4 w-4" />
            {t("budget.exportPdf")}
          </Button>
          {canEdit && (
            <Sheet>
              <SheetTrigger asChild>
                <Button><Sliders className="mr-2 h-4 w-4" />{t("budget.hypAndReforecast")}</Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md">
                <SheetHeader><SheetTitle>{t("budget.hypAndReforecast")}</SheetTitle></SheetHeader>
                <div className="mt-4 space-y-4">
                  <div>
                    <Label>{t("budget.yield")}</Label>
                    <Input type="number" placeholder={String(doc.hypotheses.rendementKgHa)}
                      value={rend} onChange={(e) => setRend(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t("budget.price")}</Label>
                    <Input type="number" step="0.01" placeholder={String(doc.hypotheses.prixVenteMADKg)}
                      value={prix} onChange={(e) => setPrix(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t("budget.startWeek")}</Label>
                    <Input type="number" placeholder={String(doc.hypotheses.semaineDebut)}
                      value={swk} onChange={(e) => setSwk(e.target.value)} />
                  </div>
                  {overrides.length > 0 && (
                    <div className="space-y-2 rounded border p-3 text-sm">
                      <div className="font-medium">{t("budget.overridesActive")}</div>
                      {overrides.map((o) => (
                        <div key={o.cle} className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{o.cle}: <b>{String(o.valeur)}</b></div>
                            <div className="text-xs text-muted-foreground truncate">
                              {t("budget.originalValue")}: {String(o.valeurOrigine ?? "—")}
                              {" · "}
                              {t("budget.byOn", {
                                author: o.auteur,
                                date: o.date ? new Date(o.date).toLocaleDateString() : "—",
                              })}
                            </div>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => restore(o.cle)}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <SheetFooter className="mt-6">
                  <Button onClick={applyReforecast} disabled={busy || (!rend && !prix && !swk)}>
                    {t("budget.reforecast")}
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      {exported && (
        <ExportedBanner e={exported} />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPI l={t("budget.recettes")} v={fmtMAD(T.recettes)} />
        <KPI l={t("budget.charges")} v={fmtMAD(T.charges)} />
        <KPI l={t("budget.marge")} v={fmtMAD(T.margeCampagne)} accent />
        <KPI l={t("budget.besoinTreso")} v={fmtMAD(T.besoinTresorerieMax)} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <KPI l={t("budget.production") + " (kg)"} v={fmtNum(T.productionKg)} />
        <KPI l={t("budget.coutHa")} v={fmtMAD(T.coutParHa)} />
        <KPI l={t("budget.coutKg")} v={T.coutParKg != null ? `${T.coutParKg} MAD` : "—"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("budget.weeklyTable")}</CardTitle>
          <CardDescription>{doc.semaines.length} {t("budget.week")}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">{t("budget.week")}</th>
                <th>{t("budget.weekCal")}</th>
                <th className="text-end">{t("budget.productionKg")}</th>
                <th className="text-end">{t("budget.recettes")}</th>
                <th className="text-end">{t("budget.totalCharges")}</th>
                <th className="text-end">{t("budget.netFlux")}</th>
                <th className="text-end">{t("budget.cumul")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {doc.semaines.map((s: any) => (
                <tr key={s.ordre}>
                  <td className="py-1.5">{s.ordre}</td>
                  <td>S{s.semaineCalendaire}</td>
                  <td className="text-end">{fmtNum(s.productionKg)}</td>
                  <td className="text-end">{fmtMAD(s.recettes)}</td>
                  <td className="text-end">{fmtMAD(s.totalCharges)}</td>
                  <td className={`text-end ${s.fluxNet < 0 ? "text-destructive" : ""}`}>{fmtMAD(s.fluxNet)}</td>
                  <td className={`text-end ${s.tresorerieCumulee < 0 ? "text-destructive" : ""}`}>{fmtMAD(s.tresorerieCumulee)}</td>
                </tr>
              ))}
              <tr className="border-t-2 font-semibold">
                <td className="py-2" colSpan={2}>{t("budget.totalRow")}</td>
                <td className="text-end">{fmtNum(T.productionKg)}</td>
                <td className="text-end">{fmtMAD(T.recettes)}</td>
                <td className="text-end">{fmtMAD(T.charges)}</td>
                <td className="text-end">{fmtMAD(T.margeCampagne)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ l, v, accent }: { l: string; v: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? "bg-primary/5" : ""}`}>
      <div className="text-xs text-muted-foreground">{l}</div>
      <div className="mt-1 text-xl font-bold">{v}</div>
    </div>
  );
}

function ExportedBanner({ e }: { e: { docId: string; sha256: string; verifyUrl: string } }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
      <FileDown className="h-5 w-5 text-primary" />
      <div className="flex-1 min-w-0">
        <div className="font-medium">{t("export.success")}</div>
        <div className="text-xs text-muted-foreground">
          {t("export.fingerprintShort", { prefix: e.sha256.slice(0, 8) })} · {t("export.proofPage")}: {e.verifyUrl}
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          navigator.clipboard.writeText(e.verifyUrl);
          toast.success(t("export.linkCopied"));
        }}
      >
        <Copy className="mr-2 h-4 w-4" /> {t("export.copyLink")}
      </Button>
    </div>
  );
}