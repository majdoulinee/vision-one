import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadReferentiel } from "@/engines/loader";
import { recommend, inverse } from "@/engines/recommendation";
import { computeBudget, reforecast } from "@/engines/budget";
import { computeBusinessPlan } from "@/engines/businessplan";
import type { Mapping, Profil, Zone } from "@/engines/types";

export const Route = createFileRoute("/_authenticated/app/engine-test")({
  ssr: false,
  component: EngineTestPage,
});

type Ref = { profils: Profil[]; mappings: Mapping[]; zones: Zone[] };

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={ok ? "text-emerald-700" : "text-red-700"}>
      {ok ? "✓" : "✗"} {label}
    </div>
  );
}

function Pane({ title, data, checks }: { title: string; data: unknown; checks?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-2 font-semibold">{title}</h3>
      {checks && <div className="mb-2 space-y-1 text-sm">{checks}</div>}
      <pre className="max-h-96 overflow-auto rounded bg-muted p-2 text-xs">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function EngineTestPage() {
  const [role, setRole] = useState<string | null>(null);
  const [ref, setRef] = useState<Ref | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [out, setOut] = useState<Record<string, any>>({});

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("platform_role")
        .eq("id", u.user.id)
        .maybeSingle();
      setRole((p?.platform_role as string) ?? "user");
      try {
        setRef(await loadReferentiel("2026.2"));
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, []);

  const tom = useMemo(() => ref?.profils.find((p) => p.code === "TOM-SERRE-EXP"), [ref]);

  if (role && role !== "admin") {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Engine Test</h1>
        <p className="mt-2 text-muted-foreground">Réservé aux administrateurs plateforme.</p>
      </div>
    );
  }
  if (err) return <div className="p-6 text-red-700">Erreur : {err}</div>;
  if (!ref || !tom) return <div className="p-6">Chargement du référentiel…</div>;

  const run = {
    reco: () => {
      const r1 = recommend(
        { zoneCode: "SOUSS", superficieHa: 5, capitalMAD: 8_000_000 },
        ref.profils,
        ref.mappings,
      );
      const r2 = recommend(
        { zoneCode: "SOUSS", superficieHa: 5, capitalMAD: 8_000_000 },
        ref.profils,
        ref.mappings,
      );
      const tomReco = r1.find((r) => r.profil.code === "TOM-SERRE-EXP");
      setOut((o) => ({
        ...o,
        reco: {
          data: r1,
          checks: (
            <>
              <Check ok={!!tomReco} label="TOM-SERRE-EXP présent dans les résultats" />
              <Check
                ok={!!tomReco && r1[0]?.score === r2[0]?.score}
                label={`Score déterministe (2 exécutions identiques) — score=${tomReco?.score}`}
              />
            </>
          ),
        },
      }));
    },
    inverse: () => {
      const r = inverse(
        { capitalMAD: 5_000_000, zoneCode: "SOUSS" },
        ref.profils,
        ref.mappings,
      );
      setOut((o) => ({
        ...o,
        inverse: {
          data: r,
          checks: <Check ok={r.length > 0} label={`${r.length} profils atteignables`} />,
        },
      }));
    },
    budget: () => {
      const b = computeBudget({
        profil: tom,
        superficieHa: 2,
        campagne: "2026-27",
        orientation: "export",
      });
      const sumCh = b.semaines.reduce((a, s) => a + s.totalCharges, 0);
      const sumRe = b.semaines.reduce((a, s) => a + s.recettes, 0);
      const b2 = computeBudget({
        profil: tom,
        superficieHa: 4,
        campagne: "2026-27",
        orientation: "export",
      });
      const ratio = b2.totaux.charges / b.totaux.charges;
      // Re-forecast
      const rf = reforecast(b, tom, [{ cle: "rendementKgHa", valeur: 150000 }], "admin");
      const ov = rf.overrides.find((o: any) => o.cle === "rendementKgHa");
      setOut((o) => ({
        ...o,
        budget: {
          data: {
            hypotheses: b.hypotheses,
            totaux: b.totaux,
            semaine1: b.semaines[0],
            semainePic: b.semaines[22],
            reforecast: { hypotheses: rf.hypotheses, totaux: rf.totaux, override: ov },
          },
          checks: (
            <>
              <Check ok={sumCh === b.totaux.charges} label="Σ semaines.totalCharges === totaux.charges" />
              <Check ok={sumRe === b.totaux.recettes} label="Σ semaines.recettes === totaux.recettes" />
              <Check
                ok={Math.abs(ratio - 2) < 0.01}
                label={`Doubler la superficie double les totaux (ratio=${ratio.toFixed(4)})`}
              />
              <Check
                ok={ov?.valeurOrigine === 190000 && !!ov?.auteur && !!ov?.date}
                label={`reforecast: valeurOrigine=${ov?.valeurOrigine}, auteur=${ov?.auteur}`}
              />
            </>
          ),
        },
      }));
    },
    bp: () => {
      const bp = computeBusinessPlan({
        profil: tom,
        superficieHa: 2,
        horizonAns: 8,
        orientation: "export",
      });
      const cons = bp.scenarios.conservateur.indicateurs.van;
      const base = bp.scenarios.base.indicateurs.van;
      const opt = bp.scenarios.optimiste.indicateurs.van;
      setOut((o) => ({
        ...o,
        bp: {
          data: {
            planInvestissement: bp.planInvestissement,
            hypothesesFinancieres: bp.hypothesesFinancieres,
            indicateurs: {
              conservateur: bp.scenarios.conservateur.indicateurs,
              base: bp.scenarios.base.indicateurs,
              optimiste: bp.scenarios.optimiste.indicateurs,
            },
            actifBiologique: bp.scenarios.base.actifBiologique,
            baseAnnees: bp.scenarios.base.annees,
          },
          checks: (
            <Check
              ok={cons <= base && base <= opt}
              label={`VAN ordonnées : conservateur (${cons}) ≤ base (${base}) ≤ optimiste (${opt})`}
            />
          ),
        },
      }));
    },
    avo: () => {
      const avo = ref.profils.find((p) => p.code === "AVO-TEST");
      if (!avo) return;
      const bp = computeBusinessPlan({
        profil: avo,
        superficieHa: 3,
        horizonAns: 10,
        orientation: "export",
      });
      const y = bp.scenarios.base.annees;
      const juveniles = y.slice(0, 4);
      const juvenilesOk = juveniles.every((a: any) => a.ca === 0 && a.capitalise > 0);
      const actifBio = bp.scenarios.base.actifBiologique;
      const dureeAmortBio = Math.max(1, avo.duree_vie_ans - avo.annees_avant_production);
      setOut((o) => ({
        ...o,
        avo: {
          data: { annees: y, actifBiologique: actifBio, dureeAmortBio },
          checks: (
            <>
              <Check
                ok={juvenilesOk}
                label="Années 1–4 : ca === 0 et capitalise > 0 (actif biologique)"
              />
              <Check ok={actifBio > 0} label={`actifBiologique = ${actifBio} > 0`} />
              <Check
                ok={dureeAmortBio === 21}
                label={`Amortissement bio réparti sur 21 ans (calc=${dureeAmortBio})`}
              />
            </>
          ),
        },
      }));
    },
  };

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Engine Test</h1>
        <p className="text-sm text-muted-foreground">
          Vérification déterministe des moteurs (référentiel 2026.2, seed TOM-SERRE-EXP + AVO-TEST).
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="rounded-md bg-primary px-3 py-2 text-primary-foreground" onClick={run.reco}>
          recommend (SOUSS, 5 ha, 8 M)
        </button>
        <button className="rounded-md bg-primary px-3 py-2 text-primary-foreground" onClick={run.inverse}>
          inverse (5 M MAD, SOUSS)
        </button>
        <button className="rounded-md bg-primary px-3 py-2 text-primary-foreground" onClick={run.budget}>
          budget TOM 2 ha + reforecast
        </button>
        <button className="rounded-md bg-primary px-3 py-2 text-primary-foreground" onClick={run.bp}>
          BP 8 ans (TOM)
        </button>
        <button className="rounded-md bg-primary px-3 py-2 text-primary-foreground" onClick={run.avo}>
          BP pérenne (AVO-TEST)
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {out.reco && <Pane title="recommend" data={out.reco.data} checks={out.reco.checks} />}
        {out.inverse && <Pane title="inverse" data={out.inverse.data} checks={out.inverse.checks} />}
        {out.budget && <Pane title="budget + reforecast" data={out.budget.data} checks={out.budget.checks} />}
        {out.bp && <Pane title="business plan" data={out.bp.data} checks={out.bp.checks} />}
        {out.avo && <Pane title="actif biologique (AVO-TEST)" data={out.avo.data} checks={out.avo.checks} />}
      </div>
    </div>
  );
}