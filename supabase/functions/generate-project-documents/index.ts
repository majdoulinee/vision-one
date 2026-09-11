// generate-project-documents — Edge Function (Deno / Supabase)
//
// VO-22 (cahier de remarques Vision One, Lot 2 "Opposable") :
// le calcul du budget et du business plan, ainsi que le débit de crédits
// correspondant, ne doivent jamais rester côté client. Cette fonction
// remplace la génération qui se faisait auparavant dans le navigateur
// (src/routes/_authenticated/app.projects.$id.prefaisabilite.$profilCode.tsx).
//
// Le client n'envoie plus que { project_id, profil_code } : ni le profil,
// ni le résultat calculé, ni la version de référentiel ne sont acceptés
// depuis la requête. Tout est relu depuis la base par cette fonction avec
// une clé de service, et le débit de crédits passe par la RPC existante
// consume_credits() (SECURITY DEFINER, écrit dans credit_ledger dans la
// même transaction), appelée avec le jeton de l'utilisateur pour que
// is_org_member()/auth.uid() se comportent exactement comme avant.
//
// Les fichiers sous ./engines sont une copie miroir de src/engines/*.ts
// (budget.ts, businessplan.ts, curves.ts, types.ts) : le moteur de calcul
// lui-même n'a pas été modifié ("DO NOT modify formulas"), seul son point
// d'exécution a changé.

import { createClient } from "npm:@supabase/supabase-js@2";
import { computeBudget } from "./engines/budget.ts";
import { computeBusinessPlan } from "./engines/businessplan.ts";
import { hydrateProfil } from "./engines/curves.ts";
import type { Profil } from "./engines/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "missing_authorization" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Scoped to the caller's own identity — used for auth.uid()-dependent
    // checks (org membership, consume_credits/refund_credits).
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    // Elevated — used only for the authoritative reads/writes this function
    // is trusted to perform once authorization has been checked above.
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const projectId = typeof body?.project_id === "string" ? body.project_id : null;
    const profilCode = typeof body?.profil_code === "string" ? body.profil_code : null;
    if (!projectId || !profilCode) return json({ error: "missing_params" }, 400);

    // Authoritative project row (service role — never trust a client-sent org_id).
    const { data: project, error: projErr } = await admin
      .from("projects")
      .select("id, org_id, data, surface_ha, capital")
      .eq("id", projectId)
      .maybeSingle();
    if (projErr) throw projErr;
    if (!project) return json({ error: "project_not_found" }, 404);

    // Authorization: the caller must be editor+ on the project's org. Checked
    // with the user-scoped client so this mirrors exactly what RLS already
    // enforces for is_org_member()/has_org_role() elsewhere in the app.
    const { data: membership, error: memErr } = await userClient
      .from("org_members")
      .select("role")
      .eq("org_id", project.org_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (memErr) throw memErr;
    if (!membership || !["owner", "admin", "editor"].includes(membership.role)) {
      return json({ error: "forbidden" }, 403);
    }

    // Published referentiel version — authoritative, read from the DB, never
    // accepted from the client (cf. VO-12).
    const { data: refVersion, error: refErr } = await admin.rpc(
      "get_published_ref_version",
    );
    if (refErr) throw refErr;
    if (!refVersion) return json({ error: "no_published_referentiel" }, 409);

    const { data: profilRow, error: profilErr } = await admin
      .from("profils_production")
      .select("code, name, data")
      .eq("ref_version", refVersion)
      .eq("code", profilCode)
      .maybeSingle();
    if (profilErr) throw profilErr;
    if (!profilRow) return json({ error: "profil_not_found" }, 404);
    const profil: Profil = hydrateProfil(profilRow);

    const projData = (project.data ?? {}) as Record<string, unknown>;
    const orientation = ((projData.orientation as string) ?? "export") as
      | "export"
      | "local";
    const horizon = Number((projData.horizon as number) ?? 7);
    const superficieHa =
      project.surface_ha ??
      (project.capital && profil.min_capital_mad_ha
        ? Math.floor((project.capital / profil.min_capital_mad_ha) * 10) / 10
        : 0);

    let bpLedgerId: string | null = null;
    let budgetLedgerId: string | null = null;
    try {
      // Reserve credits BEFORE generation, atomically, via the existing
      // ledger RPC — same order and same behaviour as the previous
      // client-side flow, just invoked from here instead of the browser.
      const { data: bpEntry, error: bpErr } = await userClient.rpc(
        "consume_credits",
        { p_org_id: project.org_id, p_action: "bp_complet" },
      );
      if (bpErr) {
        if (String(bpErr.message).includes("insufficient_credits")) {
          return json({ error: "insufficient_credits" }, 402);
        }
        throw bpErr;
      }
      bpLedgerId = (bpEntry as string | null) ?? null;

      const { data: budgetEntry, error: bErr } = await userClient.rpc(
        "consume_credits",
        { p_org_id: project.org_id, p_action: "budget_campagne" },
      );
      if (bErr) throw bErr;
      budgetLedgerId = (budgetEntry as string | null) ?? null;

      // Deterministic, server-side computation. The client never supplies
      // profil data or a computed result — only project_id + profil_code.
      const budgetDoc = computeBudget({
        profil,
        superficieHa,
        campagne: `${new Date().getFullYear()}-${(new Date().getFullYear() + 1) % 100}`,
        orientation,
        anneeProduction: profil.perenne ? profil.annees_avant_production + 1 : null,
      });
      const bpDoc = computeBusinessPlan({
        profil,
        superficieHa,
        horizonAns: horizon,
        orientation,
      });

      const [bIns, pIns, upd] = await Promise.all([
        admin
          .from("budgets")
          .insert({
            org_id: project.org_id,
            project_id: projectId,
            ref_version: refVersion,
            data: budgetDoc as any,
            overrides: [],
          })
          .select("id")
          .single(),
        admin
          .from("business_plans")
          .insert({
            org_id: project.org_id,
            project_id: projectId,
            ref_version: refVersion,
            scenarios: bpDoc as any,
            hypotheses: { orientation, horizon, superficieHa },
          })
          .select("id")
          .single(),
        admin
          .from("projects")
          .update({ profile_code: profilCode, status: "genere" })
          .eq("id", projectId),
      ]);
      if (bIns.error) throw bIns.error;
      if (pIns.error) throw pIns.error;
      if (upd.error) throw upd.error;

      await admin.from("audit_log").insert({
        org_id: project.org_id,
        action: "generate_budget_bp",
        entity_type: "project",
        entity_id: projectId,
        user_id: userId,
        meta: { profil: profilCode, ref_version: refVersion },
      });

      return json({
        budgetId: bIns.data!.id,
        businessPlanId: pIns.data!.id,
        refVersion,
      });
    } catch (e) {
      // Refund any reserved credits on failure — same safety net as before.
      if (bpLedgerId) {
        await userClient
          .rpc("refund_credits", {
            p_ledger_id: bpLedgerId,
            p_motif: "Échec génération BP (edge function)",
          })
          .catch(() => {});
      }
      if (budgetLedgerId) {
        await userClient
          .rpc("refund_credits", {
            p_ledger_id: budgetLedgerId,
            p_motif: "Échec génération budget (edge function)",
          })
          .catch(() => {});
      }
      throw e;
    }
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
