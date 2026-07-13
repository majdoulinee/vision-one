
# Refonte landing — « L'almanach de campagne »

Reprend fidèlement le mockup `agriplan-landing.html` en gardant la marque **Vision One** (le mot « PLAN » terre cuite du mockup devient « ONE » terre cuite dans le wordmark).

## 1. Design system global (`src/styles.css`)

Remplacer les tokens Forest Green/Gold par les tokens du mockup, mappés en shadcn (`@theme inline`) pour ne pas casser les pages authentifiées :

```
--ink   #12211A   → --background dark / --foreground light
--parch #F3EFE3   → --background
--parch-2 #E9E3D2 → --muted / --secondary
--line  #D2C9B2   → --border / --input
--mute  #6B7367   → --muted-foreground
--clay  #C0552F   → --primary (CTA, accents)  + --destructive fallback
--ochre #D9A521   → --accent (données/signal)
--sky   #2E6E8E   → --ring (sceau)
--radius: 4px      (au lieu de 0.5rem)
```

Ajout de tokens custom `--font-serif` (Fraunces), `--font-sans` (Instrument Sans), `--font-mono` (JetBrains Mono), et utilitaires : `.grain` (overlay SVG noise), `.hard-shadow` (10px 10px 0 parch-2), `.mono` (uppercase + tracking .16em).

**Impact** : les pages auth (auth, dashboard, wizard, budget, BP, settings, verify) prendront automatiquement la palette parchemin/terre cuite. C'est ce que l'utilisateur a choisi.

## 2. Fontes (`src/routes/__root.tsx`)

Ajout dans `head().links` : preconnect Google Fonts + stylesheet `Fraunces:600,700 + Instrument Sans:400,500,600 + JetBrains Mono:400,600`. `body` en Instrument Sans, `h1/h2/h3` en Fraunces via `@theme` (`--font-display`, `--font-body`, `--font-mono`).

## 3. Landing (`src/routes/index.tsx`)

Réécriture complète en composants React/Tailwind, ordre exact du prompt :

1. **Nav sticky** parchemin/blur. Logo `Vision` + `One` (terre cuite). Liens : Méthode · Preuve · Institutions · Tarifs · Se connecter · CTA « Pré-faisabilité gratuite » (terre cuite).
2. **Hero 2 col (1.15fr / .85fr)** :
   - Gauche : eyebrow mono chemin produit ; H1 Fraunces « Le business plan agricole que votre banque peut *vérifier*. » (italique terre cuite) ; lead ; 2 CTA (terre cuite + fantôme) ; note alternative 40–80k MAD.
   - Droite : **widget Mode inversé** interactif (input capital MAD masqué en dur, 4 chips zones aria-pressed, 3 profils recalculés côté client via catalogue statique de 8 profils × zones — inspiré des données de `src/engines`). Footer widget : « Aucun chiffre généré par une IA — normes v2026.2, provenance tracée. »
   - **Trame 52 semaines** pleine largeur sous le hero : 52 `<div class="bar">` animés en stagger 14ms, courbe en dur (préparation flat → plantation S18 → pic récolte S31 en terre cuite → S52), légende mono.
3. **Bande manifeste** fond `--ink` : eyebrow ocre « La frontière IA », phrase Fraunces avec `ne chiffre jamais` souligné ocre, paragraphe provenance/versioning/k-anonymat, tampon SVG circulaire filigrane 10% en absolute.
4. **Méthode** — grille collée 4 cellules (gap:1px sur `--border`) : Décrire / Recommander / Générer / Déposer PDF.
5. **Le référentiel (moat)** — 2 col :
   - Gauche : schéma dessiné en CSS/HTML (`Bee One` + `Comité experts` → `RÉFÉRENTIEL v2026.2` (bloc encre) → `Génération | Contre-expertise` → `PDF bancable` (bloc terre cuite)) avec `hard-shadow`.
   - Droite : `<ul>` faits avec clés mono terre cuite (~25% superficies, ha×semaine, 7 zones, versionné, k-anonymat ≥ 5).
6. **La preuve** fond `--parch-2` — 2 col :
   - Gauche : maquette PDF blanche `rotate(-1.1deg)` (se redresse au hover 0.4s), tableau d'hypothèses, ligne « forcée » en terre cuite avec suffixe `⟵ forcé, tracé`, QR SVG débordant bas-droite avec `box-shadow: 6px 6px 0 var(--ink)`.
   - Droite : flywheel `<ol>` 5 étapes numérotées `01–05` (mono bleu-sceau).
7. **Segments** — 4 col grille collée : chaque bloc = job-to-be-done en Fraunces italique terre cuite + h3 sans + description + tag PLG/SALES en absolute top-right (Investisseur / Agriculteur / Groupe / Institutionnel).
8. **Contre-expertise** fond `--ink` — tableau d'écarts (hypothèse / déclaré / norme zone avec N= / écart coloré ok/md/hi), suivi d'une `.riskbar` gradient vert→ocre→rouge avec score « 71/100 » Fraunces + lecture en 1 phrase.
9. **Tarifs** — grille collée 3 col × 2 rangées (6 cellules). Cellule « Budget de campagne 190 MAD/ha/an » avec bordure haute terre cuite 3px + badge mono « CŒUR DU MODÈLE — RÉCURRENT ». Titre italique Fraunces : « On facture la profondeur et la traçabilité. Jamais la modification. »
10. **Écosystème** — 3 blocs escalier (paddings-bottom : 26 / 48 / 70), 3ᵉ (Bee One pilote) en fond `--ink`.
11. **CTA final** centré + footer sobre (logo, mentions, liens droite, `LanguageSwitcher`).

### Interactions
- Widget Mode inversé : `useState` capital + zone, calcul déterministe local dans un `computeReco(capital, zone)` qui utilise un catalogue statique de 8 profils (nom, invest/ha MAD, marge normative %, délai retour, zones éligibles). Rend 3 lignes triées par score.
- Animation trame : keyframes `grow` avec `animation-delay: calc(var(--i) * 14ms)`.
- Reveal : `IntersectionObserver` + classe `.rv/.in` (opacity + translateY 18px, 0.7s).
- `prefers-reduced-motion` : désactive `animation` et `transition`.

## 4. i18n

La landing du mockup est **français uniquement** (comme prescrit dans `PROMPT_LOVABLE.md` § « Langue : français »). On garde `LanguageSwitcher` dans le footer, mais on **hardcode le français** sur la landing (pas de `t()` sur les nouveaux textes éditoriaux — trop de nuances de style italique/mots accentués pour passer par JSON). Le reste de l'app garde son i18n FR/EN/AR intact.

## 5. Composants extraits

Pour lisibilité, `src/routes/index.tsx` (~600 lignes) importera :
- `src/components/landing/InverseWidget.tsx`
- `src/components/landing/WeeksTrame.tsx`
- `src/components/landing/PdfMock.tsx`
- `src/components/landing/RevealOnScroll.tsx` (hook `useReveal` + wrapper)
- `src/components/landing/data.ts` (catalogue 8 profils, zones, gaps table)

## 6. Head metadata

`head()` de `/` : title « Vision One — Le business plan agricole que votre banque peut vérifier », description reprenant le lead, og:title/desc/type website, og:url `/`, canonical `/`. Pas d'og:image (pas d'image réelle générée sur la landing, tout est SVG/CSS).

## Ce qui n'est PAS touché
- `BrandLogo.tsx` (déjà Vision One) — reste utilisé dans app authentifiée et footer landing ; la nav landing utilise un wordmark éditorial `Vision + One(terre cuite)` en Fraunces.
- Routes authentifiées, moteurs, PDF export, verify — inchangés (héritent juste des nouveaux tokens couleurs).
- i18n FR/EN/AR de l'app — inchangée.
- Favicon et assets logo Vision One — inchangés.

## Vérification
Après implémentation : `bun run build` doit passer, la landing en `/` doit rendre les 11 sections dans l'ordre, la trame 52 semaines s'animer au chargement, le widget recalculer 3 profils quand on change capital/zone, et les pages authentifiées s'ouvrir sans régression visible (juste palette parchemin/terre cuite au lieu de forest green).
