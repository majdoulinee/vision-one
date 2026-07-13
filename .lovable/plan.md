# Refonte UI Comité — Design System Vision One

## Objectif
Aligner les 4 pages Comité + `ComiteShell` sur le design system almanach (parchemin, encre, ocre, argile, ciel) déjà défini dans `src/styles.css`. Aujourd'hui ces écrans utilisent des couleurs codées en dur (`#12211A`, `#D9A521`, `#C0552F`, `#2E6E8E`, `#F3EFE3`, `rgba(...)`) et un mélange de styles inline qui ne suivent pas les tokens.

## Principes design (repris de la landing / dashboard)
- Palette via tokens uniquement : `ink`, `ink-2`, `parch`, `parch-2`, `line`, `mute`, `clay`, `ochre`, `sky`
- Typo : `font-serif` (Fraunces) pour titres/versions, `mono-eyebrow` pour tags/statuts, sans par défaut
- Coins nets (`rounded-sm` max, jamais `rounded-xl`), bordures `border-line`
- Ombres dures (`hard-shadow`, `hard-shadow-ink`) sur cartes clés
- Aucune couleur en `style={{}}` — tout passe par classes Tailwind + tokens

## Périmètre (fichiers touchés — UI uniquement)

### 1. `src/components/agriplan/ComiteShell.tsx`
- Header ink → `bg-ink text-parch` (au lieu de `#12211A/#F3EFE3` inline)
- Badge « Comité d'experts » → `bg-ochre text-ink mono-eyebrow`
- Onglets actifs → `bg-parch/15 text-parch`, inactifs → `text-parch/70`
- Pipeline (BROUILLON → PUBLIÉE) : chips `bg-ochre/15 text-parch mono-eyebrow`, séparateurs `→` en `text-parch/40`
- Devise italique en `font-serif italic text-parch/70`

### 2. `src/routes/_authenticated/app.comite.propositions.tsx`
- Filtres statuts : bouton actif `bg-ink text-parch`, inactif `border-line hover:bg-muted`
- Table header : `bg-muted/50 mono-eyebrow text-mute`
- Ligne « strong » : `bg-clay/5` (remplace `bg-[hsl(15,60%,95%)]`)
- Sparklines : barres old = `fill-line`, new = `fill-sky`
- Delta ± : `text-clay` (positif = alerte) / `text-sky` (négatif = économie)
- Badges décision : APPROUVER `bg-sky text-parch mono-eyebrow`, RENVOYER `bg-ochre text-ink mono-eyebrow`
- Statut brut : chip `border-line mono-eyebrow`
- Motif renvoi : `text-clay`
- Éditeur proposition (grille 13 semaines/mois) : bordures `border-line`, delta% `text-clay/text-sky`

### 3. `src/routes/_authenticated/app.comite.bee-one.tsx`
- Carte bloquée (k-anonymat < seuil) : `border-clay bg-clay/5`, bandeau coin `bg-clay text-parch mono-eyebrow`
- Barre k-anonymat : track `bg-ink/10`, fill `bg-clay` (bloqué) ou `bg-ink-2` (ok), marqueur seuil `bg-ink`
- Labels ratio : `text-clay` / `text-ink-2` selon état, en `mono-eyebrow`
- Chips seuil / statut : `mono-eyebrow text-mute border-line`

### 4. `src/routes/_authenticated/app.comite.publish.tsx`
- Barre sticky d'action : `bg-ink text-parch hard-shadow-ink`
- Icône Lock : `text-ochre`
- Compteurs : Approuvée `text-ink-2` (vert forêt), Renvoyée `text-clay`
- Bouton « Publier » : `bg-ochre text-ink` si actif, `bg-parch/15 text-parch/50` sinon
- Encart avertissement immuable : `bg-ochre/15 border-ochre text-ink`
- Bouton confirmation final : `bg-clay text-parch`
- Devise italique : `font-serif italic`

### 5. `src/routes/_authenticated/app.comite.versions.tsx`
- Numéro version : `font-serif text-ink`
- Badge « publiée · immuable » : `bg-ochre text-ink mono-eyebrow`
- Cartes versions : `border-line hard-shadow` sur hover

## Hors périmètre
- Aucun changement de logique métier, RPC, requêtes, ou schéma
- Aucun changement de routing / hooks / permissions
- Aucun texte / copie modifié (uniquement styles)

## Vérification
- Build passe (typecheck strict)
- Navigation `/app/comite/*` : header + pipeline lisibles clair et dark
- Cohérence visuelle avec dashboard client et landing (même palette, mêmes chips mono)
- Aucun `style={{ background:'#...' }}` ni classe `bg-[#...]` restant dans les 5 fichiers
