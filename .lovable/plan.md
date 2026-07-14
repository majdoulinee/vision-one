# Passer aux Emails natifs Lovable

Oui — Lovable propose un système d'emails natif qui fonctionne sans configuration DNS pour un prototype. Il envoie depuis un domaine géré par Lovable, sans avoir besoin de vérifier un domaine chez Resend.

## Ce que je vais faire

1. **Vérifier le domaine email du projet** (`email_domain--get_project_custom_domain` + `list_email_domains`) pour confirmer qu'un domaine Lovable managé est disponible.
2. **Scaffolder le système d'emails transactionnels** via `email_domain--scaffold_transactional_email_templates`. Cela crée :
   - Un registre de templates React Email
   - Un helper `sendEmail` server-only
   - Une route `/emails/preview` pour prévisualiser les templates
3. **Créer un template `InvitationEmail`** (React Email) reprenant le branding Vision One (parchment, ochre, forest) avec :
   - Nom de l'organisation
   - Rôle proposé
   - Bouton "Accepter l'invitation" pointant vers `/invite/:token`
   - Date d'expiration
4. **Remplacer l'appel Resend actuel** dans le server function d'invitation par le helper `sendEmail` natif. Garder le fallback "lien copié" au cas où l'envoi échoue.
5. **Retirer la dépendance à `RESEND_API_KEY` et `RESEND_FROM`** pour les invitations (on peut garder le secret pour un usage futur, mais le code d'invitation n'y touche plus).
6. **Tester** en envoyant une invitation à une adresse externe et vérifier la livraison + le rendu.

## Détails techniques

- Le helper Lovable Emails utilise `LOVABLE_API_KEY` (déjà provisionnée) via le gateway — aucun secret utilisateur.
- Les emails partent depuis un sous-domaine géré Lovable (ex. `@notify.lovable.app`), déjà authentifié SPF/DKIM/DMARC côté plateforme.
- Le code d'envoi reste dans le server function `sendInvitationEmail` — seul le corps de la fonction change.
- Aucun changement UI, aucun changement de schéma DB.

## Limites à connaître (prototype)

- Volume/quotas limités par la plateforme Lovable — parfait pour une démo, à remplacer par un domaine dédié pour la prod.
- L'adresse `from` sera générique Lovable, pas `@ton-domaine.com`.
- Pour passer en prod avec ton propre domaine, il faudra vérifier un domaine custom plus tard (workflow séparé).

Confirme et je lance le scaffold + la migration du code d'invitation.