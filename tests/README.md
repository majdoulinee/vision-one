# Tests automatisés — cloisonnement multi-tenant (VO-23)

`rls-multi-tenant.test.ts` vérifie qu'une organisation ne peut jamais lire
ou modifier les données d'une autre organisation, en utilisant le jeton
réel d'un utilisateur de test plutôt qu'un accès administrateur.

## Prérequis

Le fichier `.env` à la racine du projet doit contenir (il existe déjà pour
lancer `npm run dev`, rien à ajouter) :

```
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

La clé de service (`SUPABASE_SERVICE_ROLE_KEY`) sert uniquement à préparer
et nettoyer les organisations/utilisateurs de test avant/après chaque
exécution — jamais à faire les vérifications elles-mêmes, qui passent
toutes par un client authentifié normalement.

## Lancer les tests

```
npm test
```

Chaque exécution crée deux organisations éphémères (`RLS_TEST_ORG_A_xxxx`
et `RLS_TEST_ORG_B_xxxx`) avec un utilisateur, un projet, un budget, un
business plan et un document chacune, puis les supprime à la fin (même en
cas d'échec d'un test). Un run normal ne laisse donc aucune trace dans la
base — si un run est interrompu brutalement (Ctrl+C, crash), il peut rester
une organisation `RLS_TEST_ORG_*` et un utilisateur `rls-test-*@vision-one-tests.invalid` :
il est sans risque de les supprimer à la main depuis l'admin.

## Intégration continue

Il n'y a pas encore de pipeline CI (GitHub Actions ou autre) sur ce dépôt.
Pour que cette suite tourne "à chaque déploiement" comme le recommande le
cahier de remarques, il faudrait :

1. Ajouter un workflow GitHub Actions qui lance `npm ci && npm test`.
2. Déclarer `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` et
   `SUPABASE_SERVICE_ROLE_KEY` comme secrets du dépôt GitHub (Settings →
   Secrets and variables → Actions) — la clé de service ne doit jamais être
   commitée ni mise en variable d'environnement Vercel publique.

Cette étape n'a pas été faite automatiquement : ajouter la clé de service
comme secret GitHub est une décision qui t'appartient (c'est une clé
d'accès complet à la base, à traiter avec la même prudence que le fichier
`.env`).
