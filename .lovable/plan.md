# Plan — Suivi des demandes & Alertes solde bas

## 1. Page de suivi d'une demande de crédits

**Route** : `src/routes/_authenticated/app.credits.requests.$id.tsx`

Contenu :
- En-tête : pack, crédits, montant MAD, date de création, `BackButton` vers `/app/credits`.
- Badge de statut (`en_attente` / `accordee` / `refusee`) réutilisant `StatutBadge` extrait de `app.credits.tsx` vers `src/components/agriplan/CreditStatusBadge.tsx`.
- Timeline des décisions :
  - Créée le … par le demandeur (jointure `profiles`).
  - Traitée le … par `traitee_par` (si présent).
  - Motif de refus affiché en clair si `refusee`.
- Bloc « Écriture au grand livre liée » :
  - Si `accordee`, retrouver l'entrée `credit_ledger` correspondante via `motif ILIKE '%req <id-court>%'` (motif déjà écrit par la RPC `decide_credit_request` → `grant_credits`) et afficher `id`, `delta`, `solde_apres`, `at`, avec lien copier-ID.
  - Si `en_attente` / `refusee` : afficher « Aucune écriture liée ».
- Message informatif : rappel du mode « virement / facture AGRIDATA ».

Liste dans `app.credits.tsx` : rendre chaque ligne du tableau « Mes demandes » cliquable (`<Link>` vers la nouvelle route). Aucune autre logique modifiée.

RLS : les policies existantes sur `credit_requests` et `credit_ledger` couvrent déjà la lecture par membre d'org — pas de migration.

## 2. Alertes automatiques sur solde bas

Déclencheur : `wallet.credits <= wallet.credits_alerte` (seuil déjà en base, défaut 3), niveau « ocre » = badge accent déjà utilisé dans `CreditBadge`.

### a. Toast + bannière in-app (client)

Nouveau hook `src/hooks/use-low-credit-alert.ts` :
- Lit `useWallet()`.
- Quand `credits <= credits_alerte` et `credits > 0` : émet un `toast.warning` une fois par session (clé `sessionStorage: vision-one.lowCreditToast.<orgId>.<credits>`) avec action « Voir mes crédits » → navigate `/app/credits`.
- Quand `credits === 0` : `toast.error` équivalent (« Solde épuisé »), même déduplication.

Montage : appelé dans `AppShell.tsx` (une seule instance côté layout authentifié).

Bannière persistante : dans `src/routes/_authenticated/dashboard.tsx`, afficher un encart ocre (`border-accent/50 bg-accent/10`) au-dessus du contenu quand seuil atteint, avec `<Link to="/app/credits">` en CTA. Masquée si `credits > credits_alerte`.

### b. Renforcement visuel

`CreditBadge` gère déjà les 3 tons (ok / ocre / rouge) — aucun changement.

## Détails techniques

- Nouveaux fichiers :
  - `src/routes/_authenticated/app.credits.requests.$id.tsx`
  - `src/components/agriplan/CreditStatusBadge.tsx` (extraction)
  - `src/components/agriplan/LowCreditBanner.tsx`
  - `src/hooks/use-low-credit-alert.ts`
- Fichiers modifiés :
  - `src/routes/_authenticated/app.credits.tsx` — lignes cliquables, import du badge extrait.
  - `src/components/agriplan/AppShell.tsx` — appel du hook d'alerte.
  - `src/routes/_authenticated/dashboard.tsx` — insertion de la bannière.
  - `src/locales/{fr,en,ar}.json` — clés `credits.low`, `credits.empty`, `credits.viewLink`, libellés timeline.
- Pas de migration SQL : toutes les données existent déjà (`credit_requests`, `credit_ledger`, `wallets.credits_alerte`).
- Lookup ledger côté client : `supabase.from('credit_ledger').select().eq('org_id', ...).eq('type','octroi_admin').ilike('motif', '%req <short>%').maybeSingle()`.
