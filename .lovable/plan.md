# Refonte gestion utilisateurs — 5 blocs

La migration DB est déjà passée (nouvelles RPC + policy self-leave). Il reste la partie code, à livrer en build mode.

## Bloc 1 — `/settings` (membres & invitations)

- Élargir l'invitation aux rôles `owner | admin | editor | member | viewer` (owner uniquement par un owner).
- Table membres : menu **Changer de rôle** (via `org_set_member_role`), bouton **Retirer** (`org_remove_member`), bouton **Quitter l'organisation** (`org_leave`) pour non-owner.
- Badges à côté du rôle d'org : « Comité » / « Admin plateforme » via `platform_role`.
- Section **Consultants rattachés à cette org** (liste + bouton « Demander la révocation » → `client_request_consultant_revocation`, `ReasonDialog` motif ≥ 5).
- Section **Invitations** : statuts « en attente / expirées », action **Prolonger 7 j** (`org_extend_invitation`) et **Renvoyer**.
- Rappel visuel pour comité/admin plateforme : "Vos privilèges plateforme s'exercent sur `/app/comite` ou `/app/admin`."

## Bloc 2 — Console admin utilisateurs `/app/admin/users`

- Filtres via `FilterChips` : `platform_role` (user/comite/admin), statut (actif/désactivé), + recherche existante.
- Colonne **Organisations** cliquable → popover `{org, rôle}`.
- Action **→ admin plateforme** en plus de `→ comité` (déjà supporté par `admin_set_user_platform_role`).
- Migration table vers `ComiteTable` pour l'homogénéité DS.

## Bloc 3 — Fiche utilisateur `/app/admin/users/$id`

- Profil + statut + `platform_role`.
- Orgs + rôles (lien `org_switch` pour l'admin plateforme).
- Liens consultant où l'utilisateur est membre (via ses orgs, comme consultant ou comme client).
- Historique `audit_log` filtré (`entity_id = user_id` OU meta contient user_id).
- Actions rôle plateforme / activation reprises depuis la liste.

## Bloc 4 — Espace consultant `/app/consultants`

- Route visible dans la sidebar uniquement si `current.org.type === 'consultant'`.
- Table clients rattachés (nom, rôle, source crédits, statut, date).
- Bouton **Ouvrir en mode client** via `switchOrg` de `useCurrentOrg` (si le consultant est également membre du client — sinon lien lecture seule via `client_org_id`).
- Bouton **Demander la révocation** (mêmes RPC) côté consultant.

## Bloc 5 — Petites corrections transverses

- Élargir types TS `role` (`owner|admin|editor|member|viewer`) dans `settings.tsx`, invitations, hooks.
- Traductions FR/EN/AR : `role.*`, `platform_role.*`, `consultant.role.operateur/lecteur`, labels des nouvelles pages.
- `StatusBadge` réutilisé pour statut membre/invitation.
- `AppShell` : entrée sidebar « Consultants » conditionnelle.

## Détails techniques

- Aucune nouvelle table. Utilise les RPC :
  - `public.org_set_member_role(uuid, uuid, org_role, text)`
  - `public.org_remove_member(uuid, uuid, text)`
  - `public.org_leave(uuid)`
  - `public.org_extend_invitation(uuid) → timestamptz`
  - `public.client_request_consultant_revocation(uuid, text)`
- Nouvelles routes : `src/routes/_authenticated/app.admin.users.$id.tsx`, `src/routes/_authenticated/app.consultants.tsx`.
- Nouveaux hooks : `useUserDetail(id)`, `useConsultantLinksForConsultant()`.
- Réutilise `ReasonDialog`, `FilterChips`, `ComiteTable`, `StatusBadge`.

Approuve pour passer en build mode et livrer les 5 blocs d'un coup.
