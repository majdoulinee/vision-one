# Rebranding : AGRIPLAN → Vision One

Remplacement du nom de marque **AGRIPLAN** par **Vision One** dans toute l'application, plus un nouveau logo (marque visuelle) réutilisé sur le shell app, la landing, la page auth, les invitations, la vérification publique et le PDF.

## 1. Nouveau logo

- Génération d'un logo carré « Vision One » (fond transparent, palette Forêt #1B4332 / Or #C9A227) via `imagegen`, exporté en PNG.
- Upload CDN via `lovable-assets` → pointeur `src/assets/vision-one-logo.png.asset.json`.
- Génération d'un favicon PNG dédié, placé dans `public/favicon.png`, référencé dans `__root.tsx` (`links`), et suppression de `public/favicon.ico` (règle favicon).
- Création d'un petit composant `src/components/agriplan/BrandLogo.tsx` (img + wordmark) réutilisable ; taille configurable.

## 2. Textes de marque (i18n)

Mise à jour de `src/locales/{fr,en,ar}.json` :
- `app.name` : `AGRIPLAN` → `Vision One` (FR/EN) et `أغريبلان` → `Vision One` (AR, on garde le nom latin comme demandé pour une marque produit).
- Toutes les occurrences dans `landing.*`, `verify.*`, footers, descriptions → « Vision One ».

## 3. Composants & routes à mettre à jour

- `src/components/agriplan/AppShell.tsx` : wordmark + intégration du `BrandLogo`.
- `src/routes/__root.tsx` : `title`, `description`, `og:title`, `og:description`, `author`, favicon link.
- `src/routes/index.tsx` (landing) : header/hero/footer utilisent `t("app.name")` + logo.
- `src/routes/auth.tsx` : logo + titre.
- `src/routes/invite.$token.tsx` : texte « Rejoindre une organisation Vision One », clé localStorage renommée `visionone.currentOrgId` (avec fallback lecture de l'ancienne clé pour ne pas casser les sessions en cours).
- `src/routes/verify.$docId.tsx` : titre meta, description, wordmark en tête de page.
- `src/lib/pdf-export.ts` : header PDF « Vision One », note de bas de page, nom de fichier `VisionOne_{kind}_{docId}.pdf`.
- `src/routes/_authenticated/route.tsx` et `src/routes/_authenticated/app.referentiel.tsx` : uniquement libellés de marque visibles (aucune logique modifiée).

## 4. Ce qui n'est PAS touché

- Nom du dossier `src/components/agriplan/` et alias techniques : chemins d'imports non modifiés (refactor de nommage de dossier hors scope pour éviter un diff massif sans valeur produit).
- Aucun changement DB / RLS / moteurs / migrations.
- La palette et la typographie restent identiques (identité Agridata déjà validée).

## 5. Vérification

- `bun run build` doit passer.
- Contrôle visuel : landing (header, hero, footer), auth, dashboard shell, page `/verify/:id`, export PDF (header + nom de fichier), favicon onglet navigateur.
- `rg -i "agriplan"` doit ne retourner que d'éventuels chemins de dossier `components/agriplan/` (techniques), plus aucune chaîne visible.

## Détails techniques

- Logo : PNG transparent 1024×1024, importé via `.asset.json` (règle Lovable Assets — pas de binaire commité).
- Favicon : PNG dédié 512×512 sous `public/favicon.png` ; `public/favicon.ico` supprimé.
- `BrandLogo` accepte `size` (`sm` | `md` | `lg`) et `withWordmark` (bool) pour couvrir shell (icône+texte), landing hero (grand) et PDF (généré côté client via `jsPDF.addImage` en base64 optionnel — fallback : texte seul si l'image n'est pas embarquée pour rester déterministe).
- PDF : on garde le rendu texte « Vision One » pour préserver le hash déterministe existant ; le logo image n'est PAS injecté dans le PDF pour ne pas changer les empreintes SHA-256 des documents déjà émis (les hash restent stables sur les mêmes inputs).
