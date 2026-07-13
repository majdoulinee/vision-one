## Objectif

Faire du référentiel la source de vérité pour les normes hebdomadaires **réelles** (52/duree_semaines valeurs par poste), tout en gardant la génération par courbes comme fallback pour les profils historiques (TOM-SERRE-EXP / AVO-TEST). Aucune formule de calcul (budget, BP, reco) n'est modifiée — seule la **source** des tableaux hebdomadaires change.

## Changements

### 1. Stockage (aucune migration)

`profils_production.data` (jsonb) accepte deux clés optionnelles supplémentaires :

- `charges_hebdo`: `{ main_oeuvre, intrants, irrigation_eau, energie, recolte_conditionnement, autres_charges }` — chacun `number[]` de longueur `duree_semaines`, en MAD/ha/semaine.
- `production_hebdo`: `number[]` de longueur `duree_semaines`, parts de production (Σ ≈ 1.0).

Rétrocompatible : les profils existants sans ces clés continuent d'utiliser `curves` + `charges_totaux`.

### 2. Moteurs — `src/engines/curves.ts` (`hydrateProfil`)

Ajouter un chemin prioritaire :

```text
si data.charges_hebdo présent et longueurs correctes:
    charges = data.charges_hebdo          (source: "real")
sinon:
    charges = génération bell/flat/front  (source: "modeled")

si data.production_hebdo présent et longueur correcte:
    production = data.production_hebdo    (source: "real")
sinon:
    production = bell(...) normalisé      (source: "modeled")
```

Ajouter `norms_source: "real" | "modeled" | "mixed"` sur `Profil` (dans `src/engines/types.ts`) — champ optionnel, non lu par les formules ; utilisé uniquement par l'UI.

Aucune modification à `budget.ts`, `businessplan.ts`, `recommendation.ts` — ils consomment `profil.charges` et `profil.production` déjà hydratés.

### 3. Import Excel — `NormesTab` dans `src/routes/_authenticated/app.referentiel.tsx`

Point d'écriture (ligne ~275) : au lieu de fusionner sous les clés `charges` / `production` (qui n'étaient pas relues), écrire :

```ts
const merged = {
  ...prev.data,
  charges_hebdo: u.charges,
  production_hebdo: u.production,
};
```

Les validations existantes (nb lignes = `duree_semaines`, semaines 1..N contiguës, Σ `part_production` ∈ [0.99, 1.01], numériques ≥ 0) restent en place — elles s'appliquent naturellement au nouveau format.

### 4. Affichage — `src/routes/_authenticated/app.budgets.$id.tsx`

Ajouter un badge dans l'en-tête, aligné sur les autres badges existants :

- **`Normes réelles`** (variant `default`, ton primary) si `profil.norms_source === "real"`.
- **`Normes modélisées`** (variant `outline`, ton muted) si `"modeled"`.
- **`Normes partielles`** (variant `secondary`) si `"mixed"` (charges réelles mais production modélisée, ou l'inverse).

Le badge lit `norms_source` depuis le profil hydraté déjà présent dans le composant — aucun fetch supplémentaire.

### 5. Rien à toucher

- BP page : même profil hydraté, badge non demandé (peut être ajouté plus tard si besoin).
- PDF vérifiable : les tableaux exportés reflètent déjà les valeurs hydratées, donc automatiquement les valeurs réelles après import.
- Seed existant TOM-SERRE-EXP / AVO-TEST : intact, continue en mode "modélisé".

## Critère d'acceptation

1. Après import d'un fichier Normes hebdomadaires valide pour un profil, un re-chargement du budget associé affiche **exactement** les valeurs importées (Σ semaines = totaux du fichier au MAD près).
2. Le badge **`Normes réelles`** apparaît dans l'en-tête du budget de ce profil.
3. Les profils seed non ré-importés continuent d'afficher **`Normes modélisées`** et leurs valeurs sont inchangées.
4. `tsgo --noEmit` passe.

## Suite

Une fois ce correctif livré, le script SQL "normes réelles" (22 profils × ~52 semaines = ~1 088 lignes de tableaux) pourra être exécuté par simple `UPDATE profils_production SET data = data || jsonb_build_object('charges_hebdo', ..., 'production_hebdo', ...) WHERE code = ...` sans autre changement applicatif.
