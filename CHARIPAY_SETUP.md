# Paiement en ligne ChariPay — état et étapes restantes

Contexte : en plus du circuit existant "demande de crédits + virement +
octroi manuel admin" (`src/routes/_authenticated/app.credits.tsx`), Vision
One propose maintenant un paiement en ligne par carte via
[ChariPay](https://charipay.ma) (Chari Money, agréé Bank Al-Maghrib).

Ce n'est **pas** un item de l'audit Agridata (Lot 1/2/3) — c'est une
fonctionnalité nouvelle, développée pour démo.

## Ce qui est fait

- **Base de données** (migration `supabase/migrations/20260915104800_charipay_payment_sessions.sql`,
  déjà appliquée sur le projet Supabase) :
  - table `payment_sessions` (une ligne par tentative de paiement, RLS :
    lecture membres org/admin, création owner uniquement — même règle que
    `credit_requests`) ;
  - table technique `payment_webhook_events` (déduplication des webhooks) ;
  - fonctions `charipay_mark_paid` / `charipay_mark_failed`
    (`SECURITY DEFINER`, exécutables uniquement par `service_role` — un
    utilisateur authentifié ne peut jamais se créditer lui-même, même
    verrou que `consume_credits`/`grant_credits` du Lot 2).
- **Edge Functions** (déployées) :
  - `charipay-create-session` : crée la ligne `payment_sessions` +
    la session de paiement ChariPay (`POST /v1/payment-sessions`), renvoie
    `checkoutUrl`. Le prix/nombre de crédits est recalculé côté serveur
    (jamais fait confiance au client).
  - `charipay-webhook` : reçoit la confirmation ChariPay, vérifie la
    signature HMAC-SHA256 (`X-CHARI-SIGNATURE` / `X-CHARI-TIMESTAMP`),
    déduplique, puis crédite le wallet via `charipay_mark_paid`.
- **Frontend** : bouton "Payer en ligne" sur `/app/credits` (dialogue de
  choix de pack, redirection vers la caisse ChariPay) + page de retour
  `/app/credits/retour` (poll léger sur `payment_sessions.statut` — la
  page ne crédite jamais elle-même, elle affiche juste l'état).

## Ce qu'il reste à faire (côté compte marchand, pas du code)

1. **Créer un compte sandbox ChariPay** : https://portal-psp.charipay.ma/register
   (gratuit, sans limite de temps).
2. **Récupérer la clé API sandbox** (préfixe `chari_sk_test_...`) et la
   définir comme secret Supabase (jamais dans `.env` du frontend — cette clé
   ne doit jamais atteindre le navigateur) :
   ```
   supabase secrets set CHARIPAY_API_KEY=chari_sk_test_xxx
   supabase secrets set SITE_URL=https://vision-one-khaki.vercel.app
   ```
3. **Enregistrer l'endpoint webhook** une fois (portail sandbox, ou
   `POST /api/v1/partner/webhooks/endpoints` avec la clé API) :
   - URL : `https://sbhtedyuaajnkjqurihp.supabase.co/functions/v1/charipay-webhook`
   - Événements à cocher : `payment.succeeded`, `payment.failed`,
     `order.paid`
   - La réponse contient `signingSecret` (montré **une seule fois**) — à
     définir immédiatement comme secret Supabase :
     ```
     supabase secrets set CHARIPAY_WEBHOOK_SECRET=whsec_xxx
     ```
4. **Tester** : bouton "Send a test event" du portail sandbox sur
   l'endpoint enregistré, vérifier dans les logs de la fonction
   `charipay-webhook` (Dashboard Supabase → Edge Functions → Logs) que
   l'événement est bien reçu et signé correctement.
5. **Point d'attention** : la documentation publique ChariPay ne publie pas
   le schéma exact du corps JSON livré au webhook (elle documente le
   système de livraison — retries, dédup, rotation de secret — mais pas la
   forme exacte du payload métier). `charipay-webhook/index.ts` cherche la
   référence de session (`payment_sessions.id`, envoyée comme `orderId` /
   `externalId` / `config.urls.externalReference` à la création) à
   plusieurs emplacements plausibles dans `extractSessionId()`. **Après le
   premier test réel (étape 4), vérifier dans les logs que la session est
   bien retrouvée** ; sinon, ajuster cette fonction avec le payload réel
   observé — c'est le seul endroit du code à corriger le cas échéant.
6. Une fois validé en sandbox : demander l'activation production (KYB)
   depuis le portail ChariPay, puis remplacer la clé sandbox par une clé
   `chari_sk_live_...` (et un nouvel endpoint webhook, l'environnement
   sandbox/production étant strictement séparé côté ChariPay).

## Test de la carte sandbox

Carte : `4918 9141 0719 5005` — expiration `12/27` — CVV `123`. Le 3DS de
test est indiqué sur la doc ChariPay au moment du paiement.

## Sécurité — pourquoi c'est fait ainsi

- La clé API ChariPay et le secret webhook vivent uniquement en secrets
  Supabase (Edge Functions), jamais dans le code du dépôt ni dans le
  `.env` Vite (qui est côté client).
- Le crédit du wallet ne peut se produire que via la fonction SQL
  `charipay_mark_paid`, elle-même appelable uniquement par `service_role`
  (donc uniquement depuis `charipay-webhook`, jamais depuis le navigateur).
- La confirmation ne se fait jamais sur la redirection navigateur
  (falsifiable), uniquement sur le webhook signé — recommandation
  explicite de ChariPay.
- Le montant et le nombre de crédits sont fixés côté serveur (table
  `PACKS` dans `charipay-create-session`), jamais acceptés depuis la
  requête du client.
