# Plan — Inbox notifications, fix Admin crédits, filtres demandes

## 1. Inbox notifications internes

**Table `notifications`** (migration) :
- Colonnes : `id`, `user_id` (auth.users), `org_id` (nullable), `kind` (`low_credit` | `credit_empty` | `request_accordee` | `request_refusee` | `credits_octroi`), `title`, `body`, `link` (ex: `/app/credits`, `/app/credits/requests/:id`), `read_at` (nullable), `meta` (jsonb), `created_at`.
- RLS : `select/update/delete` réservés à `user_id = auth.uid()` ; `insert` via triggers `SECURITY DEFINER` uniquement.
- GRANT `SELECT, UPDATE` à `authenticated` (marquer lu, supprimer optionnel).

**Génération auto (triggers SECURITY DEFINER)** :
- `after insert on credit_ledger` : si `type in ('octroi_admin','remboursement')` → notif à tous les membres de l'org.
- `after update on credit_requests` : quand `statut` passe à `accordee`/`refusee` → notif au `demandeur_id` avec `link` vers la page de suivi.
- Seuil bas : quand `wallets.credits` passe ≤ `credits_alerte` (trigger `after update on wallets`) → 1 notif par bascule par membre (dédup via `meta.bucket`).

**Frontend** :
- `src/hooks/use-notifications.ts` : query + realtime subscribe sur la table, expose `unreadCount`, `markAsRead`, `markAllAsRead`.
- `src/components/agriplan/NotificationBell.tsx` : cloche dans `AppShell` header (à côté de `CreditBadge`) avec badge `unreadCount`, popover listant les 10 dernières (titre/date/état lu). Clic sur item → `markAsRead` + navigation vers `link`.
- Page `/app/inbox` (`src/routes/_authenticated/app.inbox.tsx`) : liste complète paginée, filtres lu/non lu, bouton « Tout marquer comme lu ». Entrée dans la nav sidebar.
- `use-low-credit-alert` : conserver le toast, mais l'insertion en base est faite par le trigger (source de vérité unique).

## 2. Fix bouton « Admin crédits »

Le lien de la sidebar (`AppShell.tsx`) pointe vers `/app/admin/credits` mais la route générée par `app.admin.credits.tsx` sous `_authenticated` peut ne pas matcher — vérifier `routeTree.gen.ts` et corriger :
- Soit renommer le fichier en `app.admin.credits.tsx` avec `createFileRoute("/_authenticated/app/admin/credits")` (déjà le cas).
- Investiguer runtime : possible cause = `Navigate to="/dashboard"` renvoyé pendant que `usePlatformRole` cache stale, ou lien inactif. Reproduire via Playwright + logs, puis :
  - garantir `isLoading` géré,
  - vérifier que l'entrée sidebar utilise `to="/app/admin/credits"` typé (pas `as any` qui masque un mismatch),
  - corriger éventuelle collision de fichier (`app.admin.credits.tsx` vs dossier).

## 3. Filtres & recherche sur `/app/credits`

Dans la section « Mes demandes » de `app.credits.tsx` :
- Barre d'outils : `Select` statut (`Tous | en_attente | accordee | refusee`), `Input` recherche par ID (préfixe court, ex: `a1b2c3d4`).
- Filtrage client-side sur `requests.data` (liste bornée à 20 déjà) + option « voir plus » qui augmente la limite à 100.
- Persist filtres dans l'URL via `Route.useSearch` (`search: { statut?, q? }`) pour partage/bookmark.
- Highlight de l'ID court dans le tableau, lien inchangé vers `/app/credits/requests/$id`.

## Détails techniques

- Migration unique : `notifications` + 3 triggers + policies + GRANT.
- Realtime : `supabase.channel('notifications:'+userId).on('postgres_changes', …)` pour push instantané.
- i18n FR/EN/AR : clés `nav2.inbox`, `notifications.*`, `filters.status`, `filters.searchId`.
- Aucune modif backend crédits existante ; les triggers sont additifs.

## Ordre d'exécution
1. Reproduire le bug « Admin crédits » (Playwright + console) et fixer.
2. Migration `notifications` + triggers.
3. Hook + cloche + page `/app/inbox` + entrée sidebar.
4. Filtres + recherche + search params sur `/app/credits`.
5. i18n + vérif build.
