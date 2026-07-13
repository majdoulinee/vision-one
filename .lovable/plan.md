# Correctifs V1 — Plan d'exécution (5 correctifs, ordre imposé)

Un correctif = un lot appliqué et vérifié avant le suivant. Je te propose de tout planifier ici et de traiter **Correctif 1** puis **Correctif 2** dès l'accord.

---

## Correctif 1 (P0) — Seed mappings / bbox / provenance

État actuel vérifié en base : `zones=1`, `profils=2`, `mappings=2` (TOM-SERRE-EXP × SOUSS = optimal, AVO-TEST × SOUSS = **possible** — legacy). Zone SOUSS a déjà bbox correcte dans `data`.

Actions :
- Migration : `UPDATE profil_zone_mappings SET quality='eligible' WHERE profile_code='AVO-TEST' AND zone_code='SOUSS' AND quality='possible'` (nouvel enum de mapping conforme).
- Vérifier que la console `/app/referentiel` reflète bien "1 zones · 2 profils · 2 mappings".
- Ne pas toucher aux moteurs.

Vérif : wizard SOUSS/5 ha/8 M MAD/risque moyen → TOM-SERRE-EXP retourné, score reproductible.

---

## Correctif 2 (P0) — Console référentiel conforme

Refonte de `src/routes/_authenticated/app.referentiel.tsx` :
1. **Champ unique** "Nouvelle version" (obligatoire pour tout import).
2. **Onglet Zones** : colonnes `code, label, bbox_lng_min, bbox_lat_min, bbox_lng_max, bbox_lat_max`. Validations : code non vide, bbox numériques, min < max. Upsert dans `zones` (bbox stockés dans `data` JSON).
3. **Onglet Profils** : 27 colonnes exactes de la spec. Validations : enums techno/orientation/risque/provenance_source, `|invest_total − Σ4 postes| ≤ 1 %`, min_capital ≥ 0. Upsert dans `profils_production` (colonnes de tête + reste sérialisé dans `data`).
4. **Onglet Mappings** : `profil_code, zone_code, statut ∈ {optimal,eligible,exclu}`. Vérif existence des codes en base pour la version. Upsert (colonne `quality`).
5. **Onglet Normes hebdomadaires** (NOUVEAU, format long) : colonnes `profil_code, semaine, main_oeuvre, intrants, irrigation_eau, energie, recolte_conditionnement, autres_charges, part_production`. Groupement par profil_code, tri par semaine. Validations bloquantes : profil existe ; count = `duree_semaines` ; semaines 1..n consécutives sans trou/doublon ; `0.99 ≤ Σ part_production ≤ 1.01` ; toutes valeurs ≥ 0. UPDATE `profils_production.data` (6 tableaux `charges.*` + `production`).
6. **Pour chaque import** : dropzone → preview tableau (20 lignes) → liste d'erreurs ligne par ligne → bouton "Importer" désactivé si erreurs. Sur succès : upsert + INSERT `ref_versions` (statut `publiee`, `publiee_par = email courant`) + INSERT `audit_log` (`action='referentiel_import'`, meta `{type, nb_lignes, version}`).
7. **Bouton "Télécharger les modèles Excel"** : 4 fichiers .xlsx générés via SheetJS avec en-têtes exacts + 1 ligne d'exemple.

Fichiers touchés : `src/routes/_authenticated/app.referentiel.tsx` (refactor complet), `src/locales/{fr,en,ar}.json` (nouvelles clés d'erreurs et libellés d'onglets).

---

## Correctif 3 (P1) — Types d'org, rôles, membres visibles

- **Migration** : contrainte CHECK sur `organizations.type` limitée aux 7 codes spec ; backfill legacy (`ferme→agriculteur`, `cooperative→groupe`, `autre→consultant`). CHECK sur `org_members.role ∈ {owner,member,viewer}` et `invitations.role ∈ {member,viewer}` ; backfill (`admin→member`, `editor→member`).
- **Signup / paramètres** (`src/routes/auth.tsx`, `src/routes/_authenticated/settings.tsx`) : liste déroulante des 7 types traduits ; suppression du champ Pays (ou informatif sans contrainte).
- **Invitations** : choix `member/viewer` uniquement (déjà OK dans settings).
- **Membres vides** : la requête utilise `profiles!inner` qui échoue si le profil n'existe pas encore. Vérifier `handle_new_user` (l'insertion `profiles` doit être garantie) + basculer sur jointure `LEFT` + fallback email depuis `auth.users` via server fn si besoin, ou récupérer les profils en 2ᵉ requête.
- **RLS** : audit rapide des policies `projects/budgets/business_plans` pour confirmer que `viewer` = SELECT only, DELETE réservé à owner, gestion membres réservée à owner.
- **Locales** : keys `orgType.*` et `role.*` (FR/AR/EN).

---

## Correctif 4 (P1) — Landing complète

Refonte de `src/routes/index.tsx` :
1. Hero conservé, CTA principal doré (`#C9A227`) libellé "Pré-faisabilité gratuite".
2. Section "Comment ça marche" — 3 étapes numérotées.
3. Section "Le référentiel de normes" — double provenance (Bee One anonymisé + comité), versionné, citations source/région/période.
4. **Section Tarifs** (statique) — bandeau "Nous facturons la profondeur et la traçabilité, pas la modification." + 4 cartes (Pré-faisabilité gratuit / À l'acte / Abonnement campagne / Consultant sur devis).
5. Section "PDF vérifiable" — mock visuel du doc + QR + description de la page de preuve.
6. Footer avec sélecteur de langue + mentions.
7. i18n FR/AR/EN complet + vérification RTL (dir sur `<html>` déjà géré au root).

Fichiers : `src/routes/index.tsx`, `src/locales/{fr,en,ar}.json`.

---

## Correctif 5 (P1) — Dashboard compléments

Refonte de `src/routes/_authenticated/dashboard.tsx` :
1. Liste projets : nom, zone, date, badges "Budget ✓" / "BP ✓", liens directs vers `/app/budgets/:id` et `/app/business-plans/:id`.
2. Carte "Contre-expertise" grisée non-cliquable **uniquement si** `current.org.type ∈ {banque, assureur, organisme_public, groupe}`.
3. Nouvelle section "Documents exportés" : query `documents` de l'org (type, created_at, lien `/verify/:id`, bouton re-download via signed URL du bucket `documents`). Vide = message d'invite.
4. Carte "Version publiée" : garder numéro + notes en dessous (déjà OK, à vérifier).

---

## Ordre & vérifications

J'applique dans l'ordre 1 → 5, avec vérification (typecheck + smoke UI) entre chacun. Je ne regroupe pas les P0. Je te rends la main après **chaque** correctif pour validation avant de passer au suivant.

Prêt à démarrer par **Correctif 1** (petite migration + check console) puis enchaîner sur le **Correctif 2** (gros morceau : la console référentiel) ?
