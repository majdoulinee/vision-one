# Audit AGRIPLAN — Écarts entre l'implémentation et le cahier des charges

Voici, partie par partie, ce qui a été livré vs ce qui est absent ou divergent. Les points marqués 🔴 sont bloquants pour le parcours utilisateur ou pour la conformité fonctionnelle.

---

## PARTIE A — SOCLE

Livré ✓ : Auth email + Google, i18n FR/AR/EN + RTL, design tokens Agridata, tables `profiles / organizations / org_members / invitations / wallets / zones / ref_versions / profils_production / profil_zone_mappings / projects / budgets / business_plans / documents / audit_log`, RLS + helpers `is_org_member / has_org_role / is_referentiel_editor`, page `/invite/:token`, dashboard, settings.

Écarts :
- 🔴 **Enum `org_type` non conforme.** Spec : `investisseur, agriculteur, consultant, groupe, banque, assureur, organisme_public`. Actuel : `ferme, cooperative, banque, assureur, organisme_public, groupe, autre`. Les cas d'usage "investisseur" et "consultant" sont donc invisibles côté produit.
- 🔴 **Enum `org_role` non conforme.** Spec : `owner, member, viewer`. Actuel : `owner, admin, editor, viewer`. Toute la logique RBAC (invitations, RLS, panneau re-prévision) doit s'aligner sur `owner / member / viewer`.
- 🔴 **Enum `mapping_quality` non conforme.** Spec : `optimal, eligible, exclu`. Actuel : `optimal, possible, deconseille`. Impact direct sur le moteur (voir Partie B).
- **Envoi email d'invitation non branché.** Le lien `/invite/:token` fonctionne, mais aucun email n'est envoyé — l'owner doit copier le lien manuellement.
- **`ref_versions.k_anonymat` et `publiee_par` absents** (renommé `status/notes` au lieu de `statut/note`). Idem `document_type` = `business_plan` au lieu de `businessplan` (cosmétique côté PDF).
- **Wallet non créé par trigger.** `handle_new_organization` crée le membre owner mais pas la ligne `wallets(free, 3)`. À vérifier en base.
- **Signup en 2 étapes** : livré comme "signup + onboarding org sur le dashboard vide". Fonctionnel mais différent du wording spec.
- `zones.bbox_*` absents → `resolveZone(lat,lng)` inutilisable (non exposé côté UI donc non bloquant).

---

## PARTIE B — MOTEURS

Livré ✓ : `recommendation.ts`, `budget.ts`, `businessplan.ts`, `curves.ts`, `types.ts`, `loader.ts`, seed 2026.2 (SOUSS + TOM-SERRE-EXP + AVO-TEST + mappings). Page `/app/engine-test` volontairement supprimée en Partie D (conforme).

Écarts :
- 🔴 **Statuts de mapping incohérents.** Le moteur `recommendation.ts` filtre sur `statut === 'exclu'`, mais l'enum réel expose `deconseille`. Résultat : tout mapping "exclu" attendu par la spec passe soit comme "possible/deconseille", soit est rejeté à mauvais escient. À aligner (enum DB → `optimal / eligible / exclu`).
- Le seed est bien inséré mais la table `profils_production` ne contient pas exactement les colonnes spec (`invest_*`, `min_capital_mad_ha`, `provenance jsonb`, `semaine_debut_typique`, etc.) — l'engine hydrate depuis un `data` JSON compact, ce qui fonctionne mais interdit toute requête SQL directe sur ces valeurs.

---

## PARTIE C — PAGES MÉTIER

Livré ✓ : wizard 2 étapes (modes classique/inversé), pré-faisabilité gratuite, décrément atomique de crédit, `computeBudget` + `computeBusinessPlan` stockés, page budget avec KPI + tableau hebdo + drawer reforecast + overrides, page BP multi-scénarios + drawer hypothèses financières, dashboard enrichi + carte "Contre-expertise" grisée, console référentiel avec onglet Zones et Mappings.

Écarts :
- 🔴 **Landing publique incomplète.** Livré : hero + 3 cartes génériques (icônes). Manquant : section "Comment ça marche" (3 étapes textuelles), section "Le référentiel" (double provenance + k-anonymat + versioning), section "PDF vérifiable" (visuel doc + QR), **section tarifs (4 cartes : Pré-faisabilité gratuit / À l'acte / Abonnement campagne / Consultant sur devis)**, footer avec sélecteur de langue.
- 🔴 **Import Excel des Profils absent.** Onglet marqué "v2, utilisez la migration SQL" — critère d'acceptation C.5 non tenu.
- 🔴 **Import Excel des Normes hebdomadaires (format long) absent.** Onglet non présent — c'est pourtant le cœur du moat référentiel.
- 🔴 **Validations bloquantes absentes.** Aucune validation client (bbox min<max, techno/orientation/risque enums, `invest_total ≈ somme des 4 postes ±1 %`, `somme(part_production) ∈ [0.99, 1.01]`, semaines consécutives 1..n).
- 🔴 **Bouton "Télécharger les modèles Excel"** (les 4 fichiers vides avec en-têtes + ligne exemple) — absent.
- 🔴 **audit_log `referentiel_import`** non écrit après import.
- **Page Budget : graphique trésorerie (recharts, barres flux net + courbe cumul) absent.**
- **Page Budget : viewer read-only** — le panneau reforecast n'est pas gardé par le rôle (à confirmer, `canEdit` est calculé mais je n'ai pas vu son application au drawer).
- **Page BP : graphique cash-flow annuel + cash cumulé** absent.
- **Page BP : toggle "superposer les 3 scénarios"** absent.
- **Page BP : bandeau "Années 1–N : phase de mise en valeur — actif biologique X MAD…"** pour profil pérenne — à vérifier.
- **Provenance sur les recommandations** : livré comme badge simple (`bee_one` / `comite_experts`) — le format complet "Bee One · N=41 · Souss-Massa · 2023-2025" n'est pas rendu.

---

## PARTIE D — PDF VÉRIFIABLE

Livré ✓ : `src/lib/pdf-export.ts` (jsPDF + autotable + QR + SHA-256 + upload storage + insert `documents` + audit), server route publique `/api/public/verify/$docId` (bypass auth, colonnes publiques uniquement), page `/verify/$docId` (drop PDF + hash local + badge vert/rouge), boutons "Exporter PDF" activés sur budget et BP, page `/app/engine-test` supprimée.

Écarts :
- **Dashboard : section "Documents exportés"** (liste des PDF exportés avec type/date/lien preuve/re-téléchargement depuis Storage) — absente.
- **i18n `ar` pour `verify.*` et `export.*`** — à confirmer (fr/en ok, ar probablement pas).

---

## PLAN DE REMÉDIATION PROPOSÉ (ordre recommandé)

### Lot 1 — Correction d'enums (bloquant, avant tout ajout de fonctionnalité)
1. Migration Postgres : renommer les valeurs des enums `org_type`, `org_role`, `mapping_quality` pour matcher la spec, ou migrer via ALTER TYPE ADD VALUE + backfill + drop legacy.
2. Adapter `dashboard.tsx`, `settings.tsx`, `use-current-org.ts`, `recommendation.ts`, RLS helpers, i18n (`orgType.*`, `roles.*`, `mappingStatus.*`).
3. Trigger `handle_new_organization` : ajouter l'insertion `wallets(org_id, 'free', 3)`.

### Lot 2 — Console référentiel complète (moat)
1. Onglet **Profils** : parser Excel, validation (techno/orientation/risque/provenance_source enums, invest_total ≈ somme ±1 %), upsert par (`code`,`ref_version`).
2. Onglet **Normes hebdomadaires (format long)** : grouper par `profil_code`, valider `duree_semaines`, semaines consécutives, `somme(part_production)`, construire les 6 tableaux `charges` + `production`, UPDATE du profil.
3. Bouton **"Télécharger les modèles Excel"** (SheetJS write) : 4 fichiers .xlsx avec en-têtes + 1 ligne exemple.
4. Après chaque import réussi : demander `ref_version`, insérer `ref_versions` (statut `publiee`, publiee_par = email) + `audit_log` (`referentiel_import`).

### Lot 3 — Landing publique
Recomposer `/` avec 5 sections : Hero + CTA doré, "Comment ça marche" (3 étapes numérotées), "Le référentiel" (Bee One + comité + k-anonymat + versioning), "PDF vérifiable" (illustration QR + page de preuve), "Tarifs" (4 cartes statiques V1), Footer i18n.

### Lot 4 — Graphes recharts sur budget et BP
1. Budget : `ComposedChart` — barres `fluxNet` + line `tresorerieCumulee`, axe X = semaine calendaire.
2. BP : `ComposedChart` — barres `cashFlow` + line `cashCumule` sur l'horizon, toggle "afficher conservateur/base/optimiste".
3. BP : bandeau actif biologique quand `profil.perenne`.

### Lot 5 — Dashboard "Documents exportés"
Liste triée par date, colonnes type/date/lien `/verify/:id`/bouton "Retélécharger" (signed URL du bucket privé).

### Lot 6 — Finitions
1. Provenance riche sur les cartes reco : `{source} · N={n} · {region} · {periode}`.
2. Gate `viewer` sur les drawers reforecast et hypothèses BP.
3. Compléter `ar.json` pour `verify.*` et `export.*`.
4. Brancher l'envoi d'email d'invitation via `email_domain` (setup domaine + template transactionnel avec lien `/invite/:token`).

### Détails techniques

- Migration des enums : Postgres n'autorise pas `DROP VALUE`. Il faut créer un nouveau type, ajouter une colonne temporaire, copier avec mapping (`admin→member`, `editor→member`, `possible→eligible`, `deconseille→exclu`, `ferme→agriculteur`, `cooperative→groupe`, `autre→consultant`), swapper les colonnes, supprimer les anciens types.
- Import Excel côté client uniquement (SheetJS `XLSX.read` + `sheet_to_json`). Aucune donnée réelle des normes ne quitte le navigateur avant validation.
- Templates .xlsx via `XLSX.utils.book_new()` + `aoa_to_sheet` + `XLSX.write({type:'array'})` puis Blob + download.
- `audit_log` : garder la forme actuelle (`action`, `entity_type`, `entity_id`, `meta`) — c'est un sur-ensemble de `{action, details}`.

---

## RÉCAPITULATIF

| Partie | Livré | Écarts bloquants | Écarts mineurs |
|---|---|---|---|
| A Socle | ~90 % | 3 enums non conformes, wallet non auto-créé | Email invit., k_anonymat, bbox zones |
| B Moteurs | ~95 % | Filtre `exclu` inopérant (dépend Lot 1) | Colonnes SQL non spec (hydrateur OK) |
| C Pages | ~60 % | Landing incomplète, import Profils + Normes absent, modèles Excel | Graphes recharts, viewer read-only, provenance riche |
| D PDF | ~90 % | — | Dashboard "Documents exportés", ar i18n |

Dites-moi par quel lot commencer (recommandé : Lot 1 puis Lot 2, qui débloquent le reste).
