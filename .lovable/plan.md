# Plan — Bannière consultant + refonte complète console Comité

Livraison en un seul batch. Ci-dessous les impacts sur l'architecture existante (spoiler : très limités, tout tient dans l'UI Comité + une ligne dans le dashboard).

## 1. Bannière consultant sur le dashboard client

Monter `<ConsultantBanner />` en tête de `src/routes/_authenticated/dashboard.tsx`, sous `<LowCreditBanner />`. Le composant, le hook `use-consultant-links.ts` et la RPC `admin_link_consultant` existent déjà — juste 2 lignes à ajouter.

## 2. Refonte console Comité selon `PROMPT_COMITE_LOVABLE.md`

### Skin (dans `ComiteShell.tsx`)
- Ajouter le **bandeau pipeline permanent** sous la topbar : `BROUILLON → SOUMISE → VALIDÉE COMITÉ → APPROBATION ADMIN → PUBLIÉE · IMMUABLE` + note double validation.
- Nouvel onglet **Versions publiées**.
- Palette : ocre `#D9A521` déjà en place, ajouter bleu preuve `#2E6E8E` (badge BEE ONE) et vert `#4E8C5F` (validations) — en `style` inline comme aujourd'hui, pas de nouveau token global.

### Écran 1 — Diff (`app.comite.propositions.tsx`, refonte complète)
- Table diff (une ligne par proposition) : norme + clé mono, sparkline hebdo double (grises=ancienne, bleues=nouvelle) quand la valeur est un array de 52, `av → nv` + Δ % coloré (hausse terre cuite, baisse bleu, >10 % fond rosé), badge provenance BEE ONE (bleu, N + période) / COMITÉ (ocre), statut.
- Ligne dépliable : justification signée/datée, échantillon & k-anonymat, impact estimé (compte les projets qui référencent `profil_code`).
- Filtres : Toutes / Écarts > 10 % / Bee One / Comité.
- Actions par statut : Éditer + Valider (brouillon/renvoyée), Détail (validée/approuvée), Voir motif (renvoyée).
- **Règle d'édition** : édition uniquement en `brouillon` (garde-fou UI ; côté DB, `comite_submit_proposition` bloque déjà les mauvais états).

### Écran 2 — Éditeur (dialog dans le même fichier)
- Champs : profil (select depuis `profils_production`), zone (select depuis `zones`), clé de norme, **switch scalaire / hebdo 52 semaines** (grille 52 inputs + sparkline live), provenance (comité_experts OU rattachement à un lot Bee One), justification **min 20 car.**, aperçu Δ vs valeur courante en temps réel.
- Boutons : Enregistrer brouillon / Soumettre au comité.

### Écran 3 — File Bee One (`app.comite.bee-one.tsx`, upgrade)
Base existante conservée. Ajouts :
- Passage en **cartes** (au lieu de la table) avec titre / id / date / période / N en gras.
- **Jauge k-anonymat visuelle** avec trait de seuil, verte si N ≥ seuil, terre cuite sinon.
- Bandeau rouge pour lot `bloquee_k` + message explicite. Bouton Accepter désactivé, seule action : Écarter (motif).
- Lot conforme : **Accepter → crée une proposition en brouillon** pré-remplie (provenance `bee_one`, N, période) — nouvel insert dans `ref_propositions` côté client, la RPC `bee_one_examine` reste utilisée pour marquer l'ingestion.

### Écran 4 — Versions publiées (**nouvelle route** `app.comite.versions.tsx`)
Liste chronologique de `ref_versions` `publiee = true` : version, date, publieur, note, nombre de normes modifiées, lien vers un diff figé lecture seule. Mention « figée à vie ».

### Barre de publication sticky (`app.comite.publish.tsx`, upgrade)
- Sticky bottom fond vert encre, compteurs par statut du lot courant + cadenas, message explicite.
- Bouton **Publier v{n}** ocre, désactivé tant que : brouillons > 0, soumises > 0, validées non approuvées > 0, ou renvoyées non résolues.
- Modale de publication enrichie : récap (normes modifiées / profils touchés / projets clients concernés), encart d'irréversibilité fond ocre pâle, note ≥ 10 car. déjà en place, bouton terre cuite. Après publication : la RPC `comite_publish_lot` fait déjà l'immuabilité + audit ; à ajouter côté client → insertion de notifications « re-prévision gratuite v{n} » aux clients dont les projets référencent les profils touchés.

## 3. Ce qui touche à l'architecture existante

**À signaler avant de builder** :

| Zone | Impact | Risque |
|---|---|---|
| `dashboard.tsx` | +2 lignes (import + montage `<ConsultantBanner />`) | Nul |
| `ComiteShell.tsx` | Ajout bandeau pipeline + 1 onglet | Nul (skin uniquement) |
| `app.comite.propositions.tsx` | **Refonte complète** (liste JSON brute → table diff + éditeur riche) | UI actuelle disparaît. Aucun changement RPC/DB. |
| `app.comite.bee-one.tsx` | Upgrade visuel (cartes + jauge) + création d'une proposition brouillon à l'acceptation | Nouveau `insert` dans `ref_propositions` en plus de `bee_one_examine` (2 appels séquentiels côté client) |
| `app.comite.publish.tsx` | Ajout barre sticky + récap modale + trigger notifications clients | Nouvelles insertions dans `notifications` après publication |
| `app.comite.versions.tsx` | **Nouveau fichier route** | Ajout automatique dans `routeTree.gen.ts` |

**Ce qui ne bouge pas** :
- Aucune migration DB. Le schéma actuel (`ref_propositions`, `ref_lots`, `ref_versions`, `bee_one_ingestions`) et toutes les RPC (`comite_submit_proposition`, `admin_approve_proposition`, `admin_return_proposition`, `bee_one_examine`, `comite_publish_lot`) supportent déjà la spec — `nouvelle_valeur jsonb` accepte scalaire ET array 52.
- Aucun changement RLS, aucun changement crédits/consultants/admin.
- Aucun impact hors console Comité (dashboard, budget, BP, référentiel client, admin, MCP intacts).

**Point de vigilance** : la barre de publication déclenchera des notifications « re-prévision gratuite v{n} » aux clients concernés — c'est de la simple insertion dans `notifications` avec `kind = 'ref_version_published'`, mais je passe par une RPC dédiée (`comite_notify_ref_publication(lot_id)`) plutôt que du côté client, pour éviter d'exposer les `user_id` des orgs clientes au comité.

## Ordre de livraison (un seul batch)

1. Migration additive : RPC `comite_notify_ref_publication(lot_id)` (SECURITY DEFINER, appelée par le comité au moment de la publication).
2. `ComiteShell.tsx` : bandeau pipeline + onglet Versions.
3. `app.comite.propositions.tsx` : refonte diff + éditeur 52 semaines.
4. `app.comite.bee-one.tsx` : upgrade cartes + jauge + accept → proposition brouillon.
5. `app.comite.publish.tsx` : barre sticky + modale récap + call notif RPC.
6. `app.comite.versions.tsx` : nouvelle page.
7. `dashboard.tsx` : montage `<ConsultantBanner />`.
8. i18n : clés `comite.pipeline.*`, `comite.diff.*`, `comite.editor.*`, `comite.publish.*` en FR/EN/AR.

Prêt à builder dès validation.
