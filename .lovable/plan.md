## 4 correctifs UX + fix wizard projet + email invitations

### 1. Bouton retour vers landing depuis /auth
- Ajouter dans `src/routes/auth.tsx` un `<Link to="/">← Retour à l'accueil</Link>` en haut à gauche (à côté du `LanguageSwitcher`), visible sur `/auth` et `/auth?mode=signup`.
- Styles cohérents avec la charte parchemin/encre (text-ink/70 hover:text-clay).

### 2. Flèche de retour sur tous les formulaires d'ajout
Problème : le bouton "Retour" (variant ghost) est peu lisible sur fond parchemin.

Pages concernées :
- `src/routes/_authenticated/app.projects.new.tsx` (wizard — étape 2)
- `src/routes/_authenticated/app.projects.$id.prefaisabilite.$profilCode.tsx`
- `src/routes/_authenticated/app.budgets.$id.tsx`
- `src/routes/_authenticated/app.business-plans.$id.tsx`
- `src/routes/_authenticated/settings.tsx` (formulaires invitation / création org)

Remplacer les `Button variant="ghost"` "Retour" par un composant réutilisable `<BackButton />` : `<ArrowLeft />` + label, styles `text-ink border border-line hover:bg-parch-2` (bien contrasté). Créer `src/components/agriplan/BackButton.tsx` qui accepte `to` OU `onClick`.

### 3. Correction erreur création projet (voir capture "[object Object]")
Cause identifiée dans `app.projects.new.tsx > submitStep1` :
- `payload` n'inclut PAS `created_by` → colonne NOT NULL + politique RLS `WITH CHECK (created_by = auth.uid())` → 400/403.
- `status: "brouillon"` : la colonne accepte tout texte, mais le reste du code utilise `"draft"`. Aligner sur `"draft"`.
- `toast.error(String(e))` affiche `[object Object]` car les erreurs Supabase sont des `PostgrestError` (objets simples). Extraire `.message` proprement.

Correctifs :
```ts
const { data: { user } } = await supabase.auth.getUser();
const payload = { ...existing, created_by: user!.id, status: "draft" };
// et:
const msg = e?.message ?? e?.error_description ?? JSON.stringify(e);
toast.error(msg);
```
Appliquer le même utilitaire `formatError(e)` (nouveau `src/lib/format-error.ts`) partout où on toast des erreurs Supabase (auth, invite, budgets, BP, référentiel).

### 4. Activation de l'envoi d'invitation par email
Actuellement `settings.tsx` insère une ligne dans `invitations` et affiche le lien à copier manuellement. Objectif : envoyer réellement un email au destinataire avec le lien `/invite/:token`.

Approche :
- Créer une server function `sendInvitationEmail` dans `src/lib/invitations.functions.ts` (`createServerFn` + `requireSupabaseAuth`).
- Vérifier que l'appelant est owner/admin de l'org.
- Utiliser l'API Resend (secret `RESEND_API_KEY` — sera demandé via `add_secret` si absent) pour envoyer un email HTML minimaliste (charte Vision One) contenant : nom de l'org, rôle, lien absolu `${SITE_URL}/invite/${token}`, date d'expiration.
- Loguer dans `audit_log` (action `invitation.email_sent`).
- Appeler la fonction depuis `settings.tsx` juste après l'insert `invitations`; toast succès/erreur; garder l'affichage du lien en fallback.
- Bouton "Renvoyer l'email" sur les invitations en attente.

i18n : ajouter les clés `invite.emailSent`, `invite.emailFailed`, `invite.resend` dans FR/EN/AR.

### Détails techniques
- Aucune migration SQL nécessaire.
- Ajout du secret `RESEND_API_KEY` requis avant d'activer l'email (demandé à l'utilisateur si non présent).
- Le fix wizard (#4) est prioritaire — indépendant des autres correctifs.
