// VO-23 (cahier de remarques Vision One, Lot 2 "Opposable") :
//
// « Cloisonnement multi-tenant : à prouver, pas à supposer. »
// « Une suite de tests automatisés jouée à chaque déploiement : un membre
//   de l'organisation A qui tente de lire les projets, portefeuilles et
//   documents de l'organisation B, avec son propre jeton. »
//
// Ce fichier crée deux organisations éphémères (A et B), chacune avec son
// propre utilisateur, projet, portefeuille, budget, business plan et
// document — puis vérifie, avec le jeton réel de l'utilisateur B, qu'aucune
// donnée de l'organisation A n'est lisible ni modifiable. Un contrôle
// positif (l'utilisateur A lit ses propres données) garantit que les tests
// négatifs ne réussissent pas simplement parce que tout est cassé.
//
// Prérequis (.env, jamais commité) : SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
// SUPABASE_SERVICE_ROLE_KEY. La clé de service sert UNIQUEMENT à préparer
// et nettoyer les fixtures ; toutes les assertions passent par un client
// authentifié avec le jeton normal d'un utilisateur de test.
//
// Toutes les données créées sont supprimées dans afterAll (organisations +
// utilisateurs de test), y compris si un test échoue en cours de route.

import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error(
    "SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY et SUPABASE_SERVICE_ROLE_KEY doivent " +
      "être définies (.env) pour lancer les tests de cloisonnement multi-tenant.",
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const RUN_ID = crypto.randomUUID().slice(0, 8);
const PASSWORD = `Rls-Test-${crypto.randomUUID()}!A1`;

interface Tenant {
  orgId: string;
  userId: string;
  client: SupabaseClient;
  projectId: string;
  budgetId: string;
  businessPlanId: string;
  documentId: string;
}

const createdUserIds: string[] = [];
const createdOrgIds: string[] = [];

async function makeTenant(label: "A" | "B", refVersion: string): Promise<Tenant> {
  const email = `rls-test-${label.toLowerCase()}-${RUN_ID}@vision-one-tests.invalid`;

  const { data: userRes, error: userErr } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (userErr || !userRes?.user) throw userErr ?? new Error("user creation failed");
  const userId = userRes.user.id;
  createdUserIds.push(userId);

  // handle_new_user() (trigger sur auth.users) crée la ligne profiles.
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name: `RLS_TEST_ORG_${label}_${RUN_ID}`, type: "ferme", created_by: userId })
    .select("id")
    .single();
  if (orgErr || !org) throw orgErr ?? new Error("org creation failed");
  createdOrgIds.push(org.id);
  // handle_new_organization() (trigger sur organizations) crée déjà
  // org_members (owner), wallets (3 crédits) et l'écriture octroi_bienvenue.

  const { data: project, error: projErr } = await admin
    .from("projects")
    .insert({
      org_id: org.id,
      created_by: userId,
      name: `Projet test ${label}`,
      mode: "projet",
      surface_ha: 2,
      data: { orientation: "export", horizon: 7 },
    })
    .select("id")
    .single();
  if (projErr || !project) throw projErr ?? new Error("project creation failed");

  const { data: budget, error: budErr } = await admin
    .from("budgets")
    .insert({ org_id: org.id, project_id: project.id, ref_version: refVersion, data: { fake: true } })
    .select("id")
    .single();
  if (budErr || !budget) throw budErr ?? new Error("budget creation failed");

  const { data: bp, error: bpErr } = await admin
    .from("business_plans")
    .insert({
      org_id: org.id,
      project_id: project.id,
      ref_version: refVersion,
      scenarios: { fake: true },
    })
    .select("id")
    .single();
  if (bpErr || !bp) throw bpErr ?? new Error("business plan creation failed");

  const { data: doc, error: docErr } = await admin
    .from("documents")
    .insert({ org_id: org.id, created_by: userId, type: "budget", resume: { fake: true } })
    .select("id")
    .single();
  if (docErr || !doc) throw docErr ?? new Error("document creation failed");

  const client = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw signInErr;

  return {
    orgId: org.id,
    userId,
    client,
    projectId: project.id,
    budgetId: budget.id,
    businessPlanId: bp.id,
    documentId: doc.id,
  };
}

let orgA: Tenant;
let orgB: Tenant;

beforeAll(async () => {
  const { data: refVersion, error: refErr } = await admin.rpc("get_published_ref_version");
  if (refErr) throw refErr;
  if (!refVersion) {
    throw new Error(
      "Aucune version de référentiel publiée — publier une version avant de lancer les tests (cf. VO-01/Lot 0).",
    );
  }
  orgA = await makeTenant("A", refVersion as string);
  orgB = await makeTenant("B", refVersion as string);
}, 30_000);

afterAll(async () => {
  // ON DELETE CASCADE (org_members, wallets, projects, budgets,
  // business_plans, documents, credit_ledger, notifications, audit_log)
  // fait le ménage dès que l'organisation est supprimée.
  for (const orgId of createdOrgIds) {
    await admin.from("organizations").delete().eq("id", orgId);
  }
  for (const userId of createdUserIds) {
    await admin.auth.admin.deleteUser(userId);
  }
}, 30_000);

describe("Cloisonnement multi-tenant (VO-23)", () => {
  it("contrôle positif : un membre de l'org A lit bien ses propres données", async () => {
    const { data, error } = await orgA.client
      .from("projects")
      .select("id")
      .eq("id", orgA.projectId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("org B ne lit pas les projets de l'org A", async () => {
    const { data, error } = await orgB.client
      .from("projects")
      .select("id")
      .eq("org_id", orgA.orgId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("org B ne lit pas le portefeuille de crédits de l'org A", async () => {
    const { data, error } = await orgB.client
      .from("wallets")
      .select("credits")
      .eq("org_id", orgA.orgId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("org B ne lit pas les budgets de l'org A", async () => {
    const { data, error } = await orgB.client
      .from("budgets")
      .select("id")
      .eq("org_id", orgA.orgId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("org B ne lit pas les business plans de l'org A", async () => {
    const { data, error } = await orgB.client
      .from("business_plans")
      .select("id")
      .eq("org_id", orgA.orgId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("org B ne lit pas les documents de l'org A", async () => {
    const { data, error } = await orgB.client
      .from("documents")
      .select("id")
      .eq("org_id", orgA.orgId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("org B ne lit pas la liste des membres de l'org A", async () => {
    const { data, error } = await orgB.client
      .from("org_members")
      .select("user_id")
      .eq("org_id", orgA.orgId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("org B ne lit pas le grand livre de crédits de l'org A", async () => {
    const { data, error } = await orgB.client
      .from("credit_ledger")
      .select("id")
      .eq("org_id", orgA.orgId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("org B ne peut pas modifier un projet de l'org A", async () => {
    const { data } = await orgB.client
      .from("projects")
      .update({ name: "hacked" })
      .eq("id", orgA.projectId)
      .select("id");
    // RLS filtre silencieusement : 0 ligne affectée, pas d'erreur explicite.
    expect(data ?? []).toHaveLength(0);
  });

  it("org B ne peut pas modifier directement le solde de crédits de l'org A", async () => {
    const { data } = await orgB.client
      .from("wallets")
      .update({ credits: 999999 })
      .eq("org_id", orgA.orgId)
      .select("org_id");
    expect(data ?? []).toHaveLength(0);
  });

  it("org B ne peut pas déclencher consume_credits sur le portefeuille de l'org A", async () => {
    const { error } = await orgB.client.rpc("consume_credits", {
      p_org_id: orgA.orgId,
      p_action: "budget_campagne",
    });
    expect(error).not.toBeNull();
    expect(String(error?.message)).toContain("forbidden");
  });

  it("org B ne peut pas s'inviter elle-même dans l'org A", async () => {
    const { data, error } = await orgB.client
      .from("org_members")
      .insert({ org_id: orgA.orgId, user_id: orgB.userId, role: "owner" })
      .select("org_id");
    // Bloqué soit par une erreur RLS explicite (42501), soit silencieusement
    // (0 ligne) selon la policy — les deux formes prouvent l'absence d'accès.
    if (error) {
      expect(error.code === "42501" || /row-level security|permission denied/i.test(error.message)).toBe(true);
    } else {
      expect(data ?? []).toHaveLength(0);
    }
  });
});
