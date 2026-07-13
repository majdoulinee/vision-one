import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useReferentiel } from "@/hooks/use-referentiel";
import { computeBusinessPlan } from "@/engines/businessplan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import { fmtMAD, fmtNum, fmtPct } from "@/lib/format";
import { toast } from "sonner";
import { Sliders } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/business-plans/$id")({
  ssr: false,
  component: BPPage,
});

function BPPage() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();

  const bp = useQuery({
    queryKey: ["bp", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("business_plans").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const ref = useReferentiel(bp.data?.ref_version);
  const doc = bp.data?.scenarios as any;
  const profil = useMemo(
    () => ref.data?.profils.find((p) => p.code === doc?.profilCode),
    [ref.data, doc?.profilCode],
  );

  const [tauxAct, setTauxAct] = useState<string>("");
  const [partDette, setPartDette] = useState<string>("");
  const [busy, setBusy] = useState(false);

  if (!doc || !profil) return <div>{t("common.loading")}</div>;

  async function recompute() {
    setBusy(true);
    try {
      const next = computeBusinessPlan({
        profil: profil as any,
        superficieHa: doc.superficieHa,
        horizonAns: doc.horizonAns,
        orientation: doc.orientation,
        tauxActualisation: tauxAct ? Number(tauxAct) / 100 : doc.hypothesesFinancieres.tauxActualisation,
        partDette: partDette ? Number(partDette) / 100 : doc.hypothesesFinancieres.partDette,
      });
      const { error } = await supabase
        .from("business_plans")
        .update({ scenarios: next as any })
        .eq("id", id);
      if (error) throw error;
      setTauxAct(""); setPartDette("");
      toast.success("OK");
      qc.invalidateQueries({ queryKey: ["bp", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const scen = ["conservateur", "base", "optimiste"] as const;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("bp.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {doc.profilLabel} · {doc.superficieHa} ha · {doc.horizonAns} {t("bp.years")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled title={t("budget.exportPdfTip")}>{t("budget.exportPdf")}</Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button><Sliders className="mr-2 h-4 w-4" />{t("bp.finHyp")}</Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <SheetHeader><SheetTitle>{t("bp.finHyp")}</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-4">
                <div>
                  <Label>{t("bp.discountRate")} (%)</Label>
                  <Input type="number" step="0.1"
                    placeholder={String(doc.hypothesesFinancieres.tauxActualisation * 100)}
                    value={tauxAct} onChange={(e) => setTauxAct(e.target.value)} />
                </div>
                <div>
                  <Label>{t("bp.debtShare")} (%)</Label>
                  <Input type="number" step="1"
                    placeholder={String(doc.hypothesesFinancieres.partDette * 100)}
                    value={partDette} onChange={(e) => setPartDette(e.target.value)} />
                </div>
              </div>
              <SheetFooter className="mt-6">
                <Button onClick={recompute} disabled={busy || (!tauxAct && !partDette)}>{t("bp.recompute")}</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {profil.perenne && doc.scenarios.base.actifBiologique > 0 && (
        <div className="rounded-lg border border-accent bg-accent/10 p-4 text-sm">
          {t("bp.perennialBanner", {
            n: profil.annees_avant_production,
            amount: fmtMAD(doc.scenarios.base.actifBiologique),
          })}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>{t("bp.invest")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <Row l={t("bp.greenhouses")} v={fmtMAD(doc.planInvestissement.detailHa.serres)} />
          <Row l={t("bp.irrigation")} v={fmtMAD(doc.planInvestissement.detailHa.irrigation)} />
          <Row l={t("bp.plantation")} v={fmtMAD(doc.planInvestissement.detailHa.plantation)} />
          <Row l={t("bp.machinery")} v={fmtMAD(doc.planInvestissement.detailHa.machinisme)} />
          <Row l={t("bp.totalInvest")} v={fmtMAD(doc.planInvestissement.totalMAD)} bold />
          <Row l={t("bp.equity")} v={fmtMAD(doc.planInvestissement.financement.fondsPropres)} />
          <Row l={t("bp.debt")} v={fmtMAD(doc.planInvestissement.financement.dette)} />
          <Row l={t("bp.annuity")} v={fmtMAD(doc.planInvestissement.financement.annuite)} />
        </CardContent>
      </Card>

      <Tabs defaultValue="base">
        <TabsList>
          {scen.map((s) => (
            <TabsTrigger key={s} value={s}>{t(`bp.scenario.${s}`)}</TabsTrigger>
          ))}
        </TabsList>
        {scen.map((s) => {
          const sc = doc.scenarios[s];
          return (
            <TabsContent key={s} value={s} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                <KPI l={t("bp.van")} v={fmtMAD(sc.indicateurs.van)} accent />
                <KPI l={t("bp.tri")} v={sc.indicateurs.tri != null ? `${sc.indicateurs.tri}%` : "—"} />
                <KPI l={t("bp.payback")} v={sc.indicateurs.paybackAns ? `${sc.indicateurs.paybackAns} ${t("bp.years")}` : "—"} />
                <KPI l={t("bp.coutHaAvg")} v={fmtMAD(sc.indicateurs.coutParHaMoyen)} />
                <KPI l={t("bp.coutKgAvg")} v={sc.indicateurs.coutParKgMoyen != null ? `${sc.indicateurs.coutParKgMoyen} MAD` : "—"} />
              </div>
              <Card>
                <CardHeader><CardTitle>{t("bp.yearTable")}</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="py-2">{t("bp.colYear")}</th>
                        <th className="text-end">{t("bp.colCa")}</th>
                        <th className="text-end">{t("bp.colOpex")}</th>
                        <th className="text-end">{t("bp.colCap")}</th>
                        <th className="text-end">{t("bp.colEbitda")}</th>
                        <th className="text-end">{t("bp.colAmort")}</th>
                        <th className="text-end">{t("bp.colDette")}</th>
                        <th className="text-end">{t("bp.colResultat")}</th>
                        <th className="text-end">{t("bp.colCf")}</th>
                        <th className="text-end">{t("bp.colCumul")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sc.annees.map((y: any) => (
                        <tr key={y.annee}>
                          <td className="py-1.5">{y.annee}</td>
                          <td className="text-end">{fmtMAD(y.ca)}</td>
                          <td className="text-end">{fmtMAD(-Math.abs(y.opex))}</td>
                          <td className="text-end">{fmtMAD(y.capitalise)}</td>
                          <td className="text-end">{fmtMAD(y.ebitda)}</td>
                          <td className="text-end">{fmtMAD(-Math.abs(y.amortissement))}</td>
                          <td className="text-end">{fmtMAD(-Math.abs(y.serviceDette))}</td>
                          <td className="text-end">{fmtMAD(y.resultat)}</td>
                          <td className={`text-end ${y.cashFlow < 0 ? "text-destructive" : ""}`}>{fmtMAD(y.cashFlow)}</td>
                          <td className={`text-end ${y.cashCumule < 0 ? "text-destructive" : ""}`}>{fmtMAD(y.cashCumule)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
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
function Row({ l, v, bold }: { l: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded border px-3 py-2 ${bold ? "font-semibold bg-primary/5" : ""}`}>
      <span className="text-muted-foreground">{l}</span>
      <span>{v}</span>
    </div>
  );
}