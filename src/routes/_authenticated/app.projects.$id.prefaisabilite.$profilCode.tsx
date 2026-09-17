import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { usePublishedVersion, useReferentiel } from "@/hooks/use-referentiel";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { margeNormativeHa } from "@/engines/recommendation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Sparkles } from "lucide-react";
import { fmtHa, fmtMAD } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/projects/$id/prefaisabilite/$profilCode")({
  ssr: false,
  component: Prefaisabilite,
  // Bug corrigé : cette fonction ne renvoyait que { generate }, ce qui
  // supprimait silencieusement ?onboarding=1 de l'URL validée. Or le garde
  // générique de _authenticated/route.tsx s'appuie justement sur ce marqueur
  // pour laisser passer la navigation depuis l'écran Résultats du tunnel
  // d'onboarding sans renvoyer l'utilisateur en arrière. En le supprimant ici,
  // le marqueur n'atteignait jamais ce garde et la boucle revenait.
  validateSearch: (s: Record<string, unknown>) => ({
    generate: s.generate ? 1 : 0,
    onboarding: s.onboarding ? 1 : 0,
  }),
});

function Prefaisabilite() {
  const { id, profilCode } = Route.useParams();
  const { generate } = Route.useSearch() as { generate: 0 | 1 };
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { current } = useCurrentOrg();
  const version = usePublishedVersion();
  const ref = useReferentiel(version.data?.version);
  const [autoOpen, setAutoOpen] = useState<boolean>(generate === 1);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const project = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const wallet = useQuery({
    queryKey: ["wallet", current?.org_id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("credits")
        .eq("org_id", current!.org_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const pricing = useQuery({
    queryKey: ["credit_pricing"],
    queryFn: async () => {
      const { data, error } = await supabase.from("credit_pricing").select("action,cout,actif");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const bpCost = pricing.data?.find((p) => p.action === "bp_complet")?.cout ?? 3;
  const budgetCost = pricing.data?.find((p) => p.action === "budget_campagne")?.cout ?? 1;
  const totalCost = bpCost + budgetCost;

  const profil = useMemo(
    () => ref.data?.profils.find((p) => p.code === profilCode),
    [ref.data, profilCode],
  );

  const projData = (project.data?.data ?? {}) as Record<string, any>;
  const orientation = (projData.orientation ?? "export") as "export" | "local";
  const superficieHa =
    project.data?.surface_ha ??
    (project.data?.capital && profil ? Math.floor((project.data.capital / profil.min_capital_mad_ha) * 10) / 10 : 0);

  const eco = useMemo(() => {
    if (!profil) return null;
    return margeNormativeHa(profil, profil.orientation === "local" ? "local" : (orientation === "local" ? "local" : "export"));
  }, [profil, orientation]);

  useEffect(() => {
    if (autoOpen && profil && project.data && !busy) {
      setDlgOpen(true);
      setAutoOpen(false);
    }
  }, [autoOpen, profil, project.data, busy]);

  if (!profil || !project.data || !current) return <div>{t("common.loading")}</div>;

  const insufficient = (wallet.data?.credits ?? 0) < totalCost;

  async function doGenerate() {
    if (!profil || !current || !project.data) return;
    setBusy(true);
    try {
      // VO-22 : le calcul du budget/BP et le débit de crédits ne se font plus
      // ici. Le client n'envoie que l'identifiant du projet et le profil
      // choisi ; tout le reste (relecture du référentiel publié, calcul,
      // débit atomique via consume_credits, écriture budgets/business_plans)
      // est recalculé et vérifié côté serveur par la fonction Edge
      // "generate-project-documents" — voir supabase/functions/.
      const { data, error } = await supabase.functions.invoke<{
        budgetId: string;
        businessPlanId: string;
        refVersion: string;
      }>("generate-project-documents", {
        body: { project_id: id, profil_code: profilCode },
      });

      if (error) {
        let code: string | undefined;
        let message = error.message;
        try {
          const ctx = (error as any).context as Response | undefined;
          const body = await ctx?.clone().json();
          if (body?.error) {
            code = body.error;
            message = body.error;
          }
        } catch {
          // response body wasn't JSON — fall back to error.message
        }
        if (code === "insufficient_credits") {
          toast.error(t("wallet.insufficient"));
          setDlgOpen(true);
          return;
        }
        throw new Error(message);
      }
      if (!data) throw new Error("empty_response");

      qc.invalidateQueries();
      toast.success("Budget & BP");
      nav({ to: "/app/budgets/$id", params: { id: data.budgetId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setDlgOpen(false);
    }
  }

  // recharge removed — users now request credits via /app/credits

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("prefa.title")}</h1>
          <p className="text-muted-foreground">{profil.label} · {profil.culture}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {profil.perenne && (
              <Badge variant="outline">
                {t("misc.perennial", { n: profil.annees_avant_production })}
              </Badge>
            )}
            <Badge variant="outline">
              {t(`provenance.${(profil.provenance as any)?.source ?? "comite_experts"}`)}
            </Badge>
          </div>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/projects/new">
            <ArrowLeft className="mr-2 h-4 w-4" /> {t("prefa.backToWizard")}
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border border-accent bg-accent/10 p-4 text-sm">
        {t("prefa.banner")}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("prefa.econTable")}</CardTitle>
          <CardDescription>
            {fmtHa(superficieHa)} · {t(`orient.${orientation}`)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              <TR l={t("prefa.ca")} v={fmtMAD(eco?.ca)} />
              <TR l={t("prefa.opex")} v={fmtMAD(-Math.abs(eco?.opex ?? 0))} />
              <TR l={t("prefa.amort")} v={fmtMAD(-Math.abs(eco?.amort ?? 0))} />
              <TR l={t("prefa.ebitda")} v={fmtMAD(eco?.ebitda)} bold />
              <TR l={t("prefa.marge")} v={fmtMAD(eco?.marge)} bold />
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={() => setDlgOpen(true)} disabled={busy}>
          <Sparkles className="mr-2 h-4 w-4" />
          {t("prefa.generate")}
        </Button>
      </div>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent>
          {insufficient ? (
          <>
              <DialogHeader>
                <DialogTitle>{t("wallet.insufficient")}</DialogTitle>
                <DialogDescription>{t("wallet.insufficientDesc")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button asChild>
                  <Link to="/app/credits">Demander des crédits</Link>
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t("prefa.generate")}</DialogTitle>
                <DialogDescription>
                  Consommera <strong>{totalCost} crédit{totalCost > 1 ? "s" : ""}</strong> · Solde&nbsp;{wallet.data?.credits ?? 0} → {(wallet.data?.credits ?? 0) - totalCost}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDlgOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={doGenerate} disabled={busy}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t("prefa.generate")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TR({ l, v, bold }: { l: string; v: string; bold?: boolean }) {
  return (
    <tr className={bold ? "font-semibold" : ""}>
      <td className="py-2">{l}</td>
      <td className="py-2 text-end">{v}</td>
    </tr>
  );
}