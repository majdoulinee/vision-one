
# Plan — Consoles Admin / Comité / Vue client référentiel

## État actuel (déjà en place, à réutiliser tel quel)

- Crédits (A3) — `credit_ledger` append-only, `credit_pricing`, `credit_requests`, RPC `grant_credits` / `decide_credit_request` / `consume_credits` / `refund_credits`, page `/app/admin/credits` avec 4 onglets (Orgs / Demandes / Ledger / Tarifs). **Repris tel quel, déplacé sous le nouvel onglet « Crédits ».**
- `audit_log`, `notifications`, `invitations`, `platform_role` (`user|admin|comite`), `has_platform_role`, `has_org_role`.
- Référentiel : `ref_versions`, `profils_production`, `zones`, `profil_zone_mappings`, import Excel côté `/app/referentiel`. **L'import brut reste, mais devient réservé au comité et alimente le workflow de propositions.**

## Ce qui manque et sera construit

### 1. Schéma DB (migration additive, ne touche pas les tables crédits)

```sql
-- Plans d'abonnement
create table public.plans (
  code text primary key,        -- campagne | consultant | groupe | institutionnel
  label text not null,
  prix_mad numeric not null,
  quota_gen_jour int not null,
  credits_mensuels int not null default 0,
  marque_blanche bool not null default false,
  actif bool not null default true,
  updated_at timestamptz default now(),
  updated_by uuid
);

alter table public.wallets
  add column plan_code text references public.plans(code),
  add column plan_assigne_le timestamptz,
  add column plan_facture_ref text;

-- Consultants ↔ clients
create table public.consultant_links (
  id uuid primary key default gen_random_uuid(),
  consultant_org_id uuid not null references organizations(id),
  client_org_id uuid not null references organizations(id),
  role text not null check (role in ('operateur','lecteur')),
  credits_source text not null check (credits_source in ('client','consultant')),
  statut text not null default 'actif' check (statut in ('actif','revoque')),
  accorde_par uuid, accorde_le timestamptz default now(), motif_accord text,
  revoque_par uuid, revoque_le timestamptz, motif_revocation text
);

-- Propositions de normes (workflow comité → admin → publié)
create type public.proposition_statut as enum
  ('brouillon','soumise','validee_comite','approuvee_admin','publiee','rejetee','renvoyee_comite');

create table public.ref_propositions (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null,              -- regroupe une future version
  profil_code text, zone_code text,
  cle_norme text not null,           -- ex. "besoins_eau_hebdo"
  ancienne_valeur jsonb, nouvelle_valeur jsonb not null,
  provenance text not null,          -- 'comite_experts' | 'bee_one'
  bee_one_n int, bee_one_periode text,
  justification text not null,
  statut proposition_statut not null default 'brouillon',
  auteur uuid, cree_le timestamptz default now(),
  valide_comite_par uuid, valide_comite_le timestamptz,
  approuve_admin_par uuid, approuve_admin_le timestamptz,
  motif_rejet text, motif_renvoi text
);

create table public.ref_lots (
  id uuid primary key default gen_random_uuid(),
  version_cible text not null,       -- ex. "2026.3"
  statut text not null default 'en_preparation',
  note_version text,
  publie_le timestamptz, publie_par uuid
);

-- File d'ingestion Bee One (données agrégées anonymisées)
create table public.bee_one_ingestions (
  id uuid primary key default gen_random_uuid(),
  recu_le timestamptz default now(),
  profil_code text, zone_code text, cle_norme text,
  valeur_agrege jsonb, n_echantillon int, seuil_k_anonymat int default 30,
  statut text default 'a_examiner'  -- a_examiner | acceptee | ecartee | signalee
    check (statut in ('a_examiner','acceptee','ecartee','signalee','bloquee_k')),
  motif text, examine_par uuid, examine_le timestamptz
);
```

Grants + RLS :
- `plans` : SELECT authenticated, écriture via RPC admin.
- `consultant_links` : SELECT si membre de l'une des deux orgs ; INSERT/UPDATE via RPC admin (audit).
- `ref_propositions`, `ref_lots`, `bee_one_ingestions` : SELECT restreint (comité + admin), écritures via RPC.
- `wallets` : la nouvelle colonne `plan_code` ne change pas la RLS existante.

RPC `SECURITY DEFINER` (audit + garde-fous) :
- `admin_assign_plan(org_id, plan_code, facture_ref, motif)` — vérifie admin, journalise, écrit `octroi_admin` si `credits_mensuels > 0`.
- `admin_link_consultant(consultant_org, client_org, role, source, motif)` et `admin_revoke_link(link_id, motif)`.
- `admin_set_user_platform_role(user_id, role, motif)` — refuse l'auto-modification, journalise.
- `admin_toggle_user_active(user_id, actif, motif)`.
- `admin_approve_proposition(id, motif?)` / `admin_return_proposition(id, motif)` — jamais d'édition de valeur.
- `comite_publish_lot(lot_id, note_version)` — refuse si une proposition du lot n'est pas `approuvee_admin` ; fige les valeurs dans une nouvelle `ref_versions` publiée (immuable).
- `bee_one_examine(id, decision, motif)`.

### 2. Console Admin `/app/admin` (nouvelle shell)

- `src/routes/_authenticated/app.admin.tsx` = layout topbar vert encre `#12211A`, tag « ADMIN PLATEFORME », bandeau ocre permanent « MODE : OCTROI MANUEL », `<Outlet />`.
- Onglets = liens vers routes enfants :
  - `app.admin.organizations.tsx` (**A1**) — tableau + fiche latérale ; **aucune lecture du contenu** des budgets/BP, uniquement compteurs.
  - `app.admin.users.tsx` (**A2**) — activer/désactiver, promouvoir/rétrograder `comite` via modale motif.
  - `app.admin.credits.tsx` (**A3**) — la page actuelle est déplacée ici, inchangée sur le fond.
  - `app.admin.plans.tsx` (**A4**) — deux blocs séparés : lien vers Crédits + table plans éditable + modale « assigner un plan » (référence facture + motif).
  - `app.admin.consultants.tsx` (**A5**) — invitations, table `consultant_links`, modales attacher/révoquer, bouton « révoquer tous les accès ».
  - `app.admin.referentiel.tsx` (**A6**) — file des propositions `validee_comite`, diff lecture seule, boutons Approuver / Renvoyer. Bandeau « L'admin approuve, ne modifie pas le fond ». Bouton « Autoriser la publication v{n+1} » quand lot complet.
  - `app.admin.audit.tsx` (**A7**) — filtre acteur/action/org/période, export CSV.
- Redirection : `usePlatformRole()` ≠ `admin` → `<Navigate to="/dashboard" />` sur le layout.

### 3. Console Comité `/app/comite` (nouvelle shell)

- Layout tag ocre « COMITÉ D'EXPERTS ».
- `app.comite.propositions.tsx` (**B1**) — éditeur (profil, zone, clé, valeur, provenance, justif), machine à états, actions soumettre/valider/rejeter.
- `app.comite.bee-one.tsx` — file d'ingestion, accepter / écarter / signaler ; les lots sous `k_anonymat` sont bloqués et visuellement grisés.
- `app.comite.diff.tsx` — diff v courante ↔ lot, norme par norme.
- `app.comite.publish.tsx` — modale de publication avec note obligatoire ; refusée si une proposition n'est pas `approuvee_admin`.

### 4. Vue client référentiel (**C**)

- `app.referentiel.tsx` (existant) devient **lecture seule** pour les non-comité, avec :
  - Bandeau publication « v{n} publiée — X normes concernent vos profils » (calculé sur les profils/zones des projets de l'utilisateur).
  - Écran « Ce qui a changé pour vous » : table filtrée, jamais d'export machine-readable, jamais de norme hors périmètre.
  - Bouton « Re-prévoir mes budgets avec la v{n} » → appelle le moteur de re-prévision existant avec `cout = 0` (déjà tarifé 0 dans `credit_pricing`).
- L'onglet « Import Excel » actuel est déplacé sous la console Comité.

### 5. Transparence consultant côté client

- `src/hooks/use-consultant-links.ts` — lit les liens actifs où `client_org_id = orgCourante`.
- `src/components/agriplon/ConsultantBanner.tsx` inséré dans `AppShell` sous le header : « Le cabinet {X} a accès à votre organisation ({rôle}), accordé le {date} · [Demander la révocation] » → crée une notification `admin` (type `revoke_request`).
- Toute génération (budget/BP/pré-fai) faite quand `orgCourante` est un client consulté écrit `via = consultantOrgId` dans `documents` et `credit_ledger.meta`.

### 6. Design system (rappels)

- Palette parchemin déjà en place. Ajouter à `styles.css` les tokens `--admin-topbar: #12211A`, `--mode-banner: hsl var(--accent)` pour bandeau ocre, `--proof-blue: #2E6E8E` (vérification uniquement).
- Composants réutilisables : `<AdminShell>`, `<ModeBanner>`, `<ReasonDialog>` (motif obligatoire ≥ N caractères, journalisé) — mutualisés pour toutes les actions sensibles.

### 7. Garde-fous (**D**) — implémentés, pas juste affichés

- `ref_versions.publiee = true` ⇒ trigger `BEFORE UPDATE` bloque toute modification.
- `admin_approve_proposition` refuse d'écrire une nouvelle valeur (juste change `statut`).
- `comite_publish_lot` : `EXISTS (statut != approuvee_admin) ⇒ RAISE`.
- Toute RPC sensible écrit dans `audit_log` (acteur = `auth.uid()`, cible, motif).
- `admin_deactivate_*` au lieu de `DELETE` partout.

### 8. i18n

Nouvelles clés FR/EN/AR : `admin.*` (organizations, users, credits, plans, consultants, referentiel, audit), `comite.*`, `referentiel.client.*`, `consultant.banner.*`, `plan.*`.

## Ordre d'exécution (batchs livrables)

1. **Migration DB** : plans, `wallets.plan_code`, `consultant_links`, `ref_propositions`, `ref_lots`, `bee_one_ingestions` + RLS + RPC + triggers d'immuabilité + seed plans par défaut.
2. **Refonte layout admin** : `/app/admin` shell + déplacement de la page crédits actuelle sous `/app/admin/credits` (route parente). Redirection sidebar mise à jour.
3. **A1 Organisations** + **A2 Utilisateurs** + **A7 Audit** (les 3 sont des lectures/toggles simples).
4. **A4 Plans** + assignation → wallet (branché à `octroi_admin` existant).
5. **A5 Consultants** + bannière client + marquage `via` dans les générations.
6. **Console Comité** (B) : propositions, Bee One, diff, publication.
7. **A6 Approbation admin** (dépend de B).
8. **Vue client référentiel** (C) : bandeau publication, « ce qui a changé pour vous », re-prévision.
9. i18n + tests visuels (Playwright screenshots) + vérif build.

## Non-régressions à vérifier avant chaque batch

- Les 4 onglets actuels de `/app/admin/credits` restent fonctionnels après le déplacement sous `/app/admin`.
- Aucun changement de RPC crédits, aucun changement de `credit_ledger` / `credit_pricing`.
- La page `/app/referentiel` ne perd pas l'import Excel (déplacé vers la console comité, pas supprimé).
- La sidebar « Admin crédits » redirige toujours (alias) vers le nouvel emplacement.
