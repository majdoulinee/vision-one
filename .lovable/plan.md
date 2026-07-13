# AGRIPLAN — Plan global (vue d'ensemble des 4 parties)

## Ce que je propose

Livrer AGRIPLAN en **4 phases séquentielles**, une par prompt, avec validation des critères d'acceptation entre chaque phase. Je ne commencerai à coder qu'après ton feu vert sur ce plan global, puis on démarrera par la Partie A.

## Principes directeurs (valables sur les 4 phases)

- **Calcul 100 % déterministe** — aucun LLM dans les moteurs, formules portées EXACTEMENT comme dans le prompt B (pas d'"amélioration", pas d'arrondi maison).
- **Granularité budget = semaine**, jamais mois. Devise MAD, format `1 250 000 MAD`.
- **Multi-tenant strict** via RLS ; helpers `is_org_member(org_id)`, `has_org_role(org_id, roles[])` SECURITY DEFINER pour éviter la récursion.
- **i18n FR / AR / EN** dès la Partie A, RTL complet pour l'arabe (`ms-/me-/ps-/pe-`).
- **Design system Agridata** : vert forêt `#1B4332`, or `#C9A227`, fond `#FAF9F6`, Inter — tokens sémantiques dans `src/styles.css`, jamais de couleurs hardcodées dans les composants.
- **Anti-exfiltration** : aucun export CSV/JSON des normes hebdomadaires côté utilisateur.
- **Overrides** toujours stockés et affichés avec `{cle, valeur, valeurOrigine, auteur, date}`.

## Phase 1 — Partie A : Socle (Auth + RBAC + Schéma + Design + i18n)

- Activer **Lovable Cloud** (Supabase managé) avant tout code.
- Auth email/mot de passe + **Google** (défaut Cloud). Signup en 2 étapes : compte → création d'organisation (1 des 7 types) ; l'utilisateur devient `owner`, wallet créé (`free`, 3 crédits) via trigger Postgres.
- Schéma complet migré maintenant (même les tables utilisées plus tard) : `profiles, organizations, org_members, invitations, wallets, zones, ref_versions, profils_production, profil_zone_mappings, projects, budgets, business_plans, documents, audit_log`. GRANTs explicites sur toutes.
- RLS activée partout ; référentiel lisible auth, éditable par `admin`/`comite` via `is_referentiel_editor()`.
- Bucket Storage privé `documents` créé maintenant.
- Pages : `/auth` (login+signup), `/invite/:token`, `/app` (dashboard vide + shell), `/app/settings` (membres + invitations).
- i18n `i18next` + `<html dir>` dynamique.
- **Sortie de phase = critères A.1→A.5 verts**, notamment isolation cross-tenant (A.3) et bascule RTL arabe (A.5).

## Phase 2 — Partie B : 4 moteurs déterministes

- Dossier `src/engines/` avec 3 fichiers principaux + 1 helper : `recommendation.ts`, `budget.ts`, `businessplan.ts` (+ types partagés). Code copié tel quel depuis le prompt B — aucune "optimisation".
- Migration seed : zone `SOUSS`, version `2026.2`, profil `TOM-SERRE-EXP` (avec charges/production hebdo générés par les fonctions `bell/flat/front` documentées), mapping `TOM-SERRE-EXP × SOUSS = optimal`, + profil `AVO-TEST` pérenne pour valider B.5.
- Page temporaire `/app/engine-test` (visible `platform_role='admin'` uniquement) : 4 boutons de test avec affichage JSON brut + vérifs vertes/rouges.
- **Points de vigilance** : B.4 (VAN calculée sur flux **ordonnés** dans le temps, pas simple somme) et B.5 (pérenne : charges capitalisées années 1..N, actif biologique amorti ensuite).

## Phase 3 — Partie C : Pages métier + parcours + import Excel

- **Landing publique `/`** avec sections Hero / Comment ça marche / Référentiel / PDF vérifiable / Tarifs (statique) / Footer — `head()` propre (title, description, og).
- **Wizard `/app/projects/new`** — 2 modes (projet / capital), sauvegarde dans `projects` à l'étape 1, appelle `recommend()` ou `inverse()` pour l'étape 2.
- **Pré-faisabilité gratuite** `/app/projects/:id/prefaisabilite/:profilCode` — pas de débit.
- **Génération complète** : check `wallets.credits > 0`, décrément atomique `credits = credits - 1 where credits > 0`, sinon modal + bouton **« Recharger (démo) »** owner-only (+5 crédits, paiement simulé V1). Audit log.
- **Page budget `/app/budgets/:id`** : totaux, graph trésorerie (Recharts), tableau hebdo dense, drawer re-prévision → appelle `reforecast()` avec l'utilisateur courant comme auteur, liste des overrides avec « Restaurer », badge « X hypothèses forcées ». `viewer` en lecture seule.
- **Page BP `/app/business-plans/:id`** : onglets scénarios, cartes VAN/TRI/payback, tableau annuel, graph cash-flow/cash cumulé, drawer hypothèses financières.
- **Dashboard enrichi** : liste projets, crédits, version référentiel ; carte placeholder « Contre-expertise V2 » pour orgs `banque/assureur/organisme_public/groupe`.
- **Console référentiel `/app/referentiel`** (admin/comite) : 4 imports Excel via `xlsx` (Zones / Profils / Normes hebdo format long / Mappings) avec preview + validation ligne à ligne + upsert par `code`. Demande la nouvelle version → insert `ref_versions` + `audit_log`. Bouton « Télécharger les modèles Excel ».
- Boutons « Exporter PDF vérifiable » présents mais **désactivés** avec tooltip « bientôt » — ils s'activent en Partie D.
- **Points de vigilance** : C.3 re-prévision (recalcul instantané, `valeurOrigine` = première origine, pas la valeur précédente) ; C.5 import Excel avec vraies validations bloquantes.

## Phase 4 — Partie D : PDF bancable vérifiable

- Génération PDF **client-side** avec `jspdf` + `jspdf-autotable` + `qrcode` (évite les libs Node incompatibles Cloudflare Workers).
- Flux : create `documents` d'abord (pour connaître l'ID) → génère QR pointant `/verify/:id` → compose PDF A4 (bandeau vert, QR en haut à droite, sections Projet / Référentiel / Budget ou BP / Overrides / Pied) → SHA-256 via Web Crypto → UPDATE `documents` avec `sha256` + `storage_path` → upload Storage `{orgId}/{docId}.pdf` → download local → audit log. Le PDF n'est généré **qu'une fois**, ensuite servi depuis Storage.
- **Route `/verify/:docId` publique non authentifiée** (route TanStack top-level, hors `_authenticated/`) qui appelle un **server route `/api/public/verify/:docId`** (pas Edge Function Supabase — TanStack Start a son propre runtime serveur). Ce endpoint utilise `supabaseAdmin` (service role, chargé via `await import(...)` dans le handler) et retourne UNIQUEMENT `{type, created_at, ref_version, provenance, overrides, resume, sha256}` — jamais `org_id`, `source_id`, `storage_path` ni le PDF.
- Page `/verify/:docId` : affiche métadonnées + bloc « Vérifier mon fichier » qui recalcule le SHA-256 côté client sur le PDF déposé et compare (badge vert/rouge). Le fichier ne quitte jamais le navigateur, indiqué à l'utilisateur.
- Activer les boutons « Exporter PDF » sur budget et BP, ajouter section « Documents exportés » au dashboard, supprimer `/app/engine-test`.
- **Points de vigilance** : test D.2 en navigation privée déconnectée ; stabilité du hash (D.5 : ne pas régénérer le PDF à chaque téléchargement).

## Hors périmètre V1 (à refuser si Lovable les propose)

Contre-expertise IA de BP tiers, workflow comité de publication, console admin complète, paiement réel CMI/Stripe, quotas anti-exfiltration & canari, carte Leaflet, benchmark multi-fermes, API DaaS.

## Notes techniques (stack Lovable actuelle)

- **Stack** : TanStack Start v1 + React 19 + Vite 7 + Tailwind v4 + Lovable Cloud (Supabase managé). Le prompt A mentionne "Edge Functions Supabase" — je remplace par **`createServerFn`** pour la logique app-interne, et **server routes `/api/public/*`** pour la page de preuve (le runtime serveur TanStack Start remplace les Edge Functions Supabase pour ce projet).
- **Rôles plateforme** (`platform_role` sur `profiles`) : le prompt place la colonne sur `profiles` ; je respecte le schéma demandé mais j'ajoute la fonction `has_platform_role()` SECURITY DEFINER pour lecture RLS sans récursion. Les rôles **organisation** sont bien dans `org_members` (table dédiée).
- **PDF** : `jspdf` est pure JS, compatible browser — génération 100 % client comme spécifié, aucune contrainte Worker.
- **SHA-256** : Web Crypto (`crypto.subtle.digest`) disponible browser et Worker.
- **QR** : `qrcode` (npm) → data URL PNG intégrée dans le PDF.
- **Auth broker Google** : `lovable.auth.signInWithOAuth("google", ...)` + `supabase--configure_social_auth` dans la même phase.
- **Route protection** : layout `_authenticated/route.tsx` géré par l'intégration Lovable Supabase (ne pas réécrire). `/verify/:docId` reste top-level public.
- **Serveur** : `process.env.*` lu uniquement dans les handlers ; `client.server` importé dynamiquement (`await import(...)`) dans les handlers de server routes/functions.

## Ce dont j'ai besoin pour démarrer la Partie A

Ton feu vert sur ce plan global. Ensuite je bascule en build mode et j'implémente la Partie A d'un coup (schéma + auth + RBAC + design + i18n + pages), puis on valide les critères A.1→A.5 ensemble avant d'attaquer la Partie B.
