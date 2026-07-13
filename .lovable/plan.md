## Objectif

Corriger le graphique 52 semaines manquant (barres invisibles) et aligner la landing sur le HTML de référence `agriplan-landing-2.html` — copie littérale, seule différence : la marque reste **VisionOne**.

## Correctif 1 — Le graphique 52 semaines (cause du bug)

Dans `WeeksTrame.tsx` les barres ont `scale-y-0` + `animation: bar-grow …`, mais aucun `@keyframes bar-grow` n'existe dans `src/styles.css`. Résultat : les barres restent écrasées à zéro (exactement ce que montre la capture avec la flèche rouge).

**Fix :** ajouter dans `src/styles.css` :
```css
@keyframes bar-grow { to { transform: scaleY(1); } }
```
Vérifier aussi que `.grain-overlay`, la couleur `bg-ink-2`, `text-clay`, `text-ochre`, `border-ink` sont bien exposées dans le thème Tailwind v4 (`@theme` dans `styles.css`) — sinon les barres de pic (clay) et cash (ochre) ne s'affichent pas non plus.

## Correctif 2 — Alignement au HTML de référence

Repasser `src/routes/index.tsx` section par section face à `agriplan-landing-2.html` et corriger tous les écarts de structure/typo/copy pour obtenir une copie littérale :

- Nav : liens `Méthode / Preuve / Institutions / Tarifs / Se connecter` + CTA `Pré-faisabilité gratuite` (déjà OK, vérifier l'ordre et le style).
- Hero : eyebrow, H1 avec `<em>vérifier</em>` en italique clay, lead, deux CTA (clay + ghost), note.
- Widget "Mode inversé" (`InverseWidget`) : header ink/parch, capital input + MAD, 4 chips zones, 3 résultats animés, footer parchemin — vérifier libellés exacts.
- **Trame semaines** : titre + légende identiques, 52 barres avec pics S18–S22 (cash ocre) et S29–S34 (peak clay) — animation réparée par le correctif 1.
- Manifeste (bloc sombre) : eyebrow ocre "La frontière IA", grande phrase serif avec `ne chiffre jamais` souligné ocre, paragraphe secondaire.
- Sections 01→04 (Méthode, Référentiel/Moat, Preuve, Segments) : titres, sous-titres, cartes, listes — texte exact du HTML.
- Contre-expertise (fond ink) : tableau écarts, barre de risque.
- Tarifs : 3 cartes (Découverte / Pré-faisa / Pro), carte milieu `star`, badge, note italique serif.
- Escalier institutions (3 marches, la 3ᵉ ink).
- CTA final centré + footer.

Seul changement autorisé vs HTML : `AGRI<span>PLAN</span>` → `Vision<span>One</span>` dans le wordmark (nav + footer + title/meta). Tout le reste de la copy reste tel quel (y compris "AGRIPLAN" dans le body devient "Vision One").

## Vérification

- Ouvrir `/` dans le preview, prendre une capture Playwright de la trame 52 semaines : les barres doivent former la courbe (préparation basse → plantation ocre → pic clay → décrue).
- Vérifier que la page ne contient plus "AGRIPLAN" (`rg -i agriplan src/routes/index.tsx` → 0 résultat).
- Contrôler visuellement les 11 sections vs le HTML de référence.

## Portée

Fichiers touchés :
- `src/styles.css` (keyframe + tokens manquants éventuels)
- `src/routes/index.tsx` (alignement copie)
- `src/components/landing/WeeksTrame.tsx` (si besoin, mais logique OK une fois le keyframe ajouté)
- `src/components/landing/InverseWidget.tsx` / `PdfMock.tsx` (seulement si la copie diverge du HTML)

Aucun changement backend, aucun changement business logic.
