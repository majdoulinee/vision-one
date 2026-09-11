-- Lot 1 (audit Agridata 07/09/2026) : VO-06, VO-07, VO-08.

-- VO-06 : "L'octroi de bienvenue n'a donc pas été écrit au journal."
-- Le grand livre doit refléter TOUTE mutation de crédit, y compris l'octroi
-- initial (jusqu'ici fait par un simple INSERT direct dans wallets).

ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_type_check;
ALTER TABLE public.credit_ledger
  ADD CONSTRAINT credit_ledger_type_check
  CHECK (type IN ('octroi_admin','octroi_bienvenue','consommation','remboursement','ajustement','achat_en_ligne'));

CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner'::public.org_role)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.wallets (org_id, plan, credits)
  VALUES (NEW.id, 'free'::public.wallet_plan, 3)
  ON CONFLICT (org_id) DO NOTHING;

  -- Écriture de l'octroi initial au grand livre, pour que solde = Σ(écritures)
  -- soit vrai dès la création de l'organisation (et non uniquement à partir
  -- de la première consommation/octroi admin).
  IF NOT EXISTS (SELECT 1 FROM public.credit_ledger WHERE org_id = NEW.id) THEN
    INSERT INTO public.credit_ledger(org_id, delta, solde_apres, type, auteur_id, motif)
    VALUES (NEW.id, 3, 3, 'octroi_bienvenue', NEW.created_by, 'Octroi de bienvenue (plan gratuit)');
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill : toute organisation existante dont le portefeuille n'a aucune
-- écriture au grand livre (cas constaté par l'audit sur le compte de test)
-- reçoit une écriture rétroactive reflétant son solde actuel.
INSERT INTO public.credit_ledger (org_id, delta, solde_apres, type, auteur_id, motif)
SELECT w.org_id, w.credits, w.credits, 'octroi_bienvenue', o.created_by,
       'Octroi de bienvenue (plan gratuit) — écriture rétroactive'
FROM public.wallets w
JOIN public.organizations o ON o.id = w.org_id
WHERE NOT EXISTS (SELECT 1 FROM public.credit_ledger cl WHERE cl.org_id = w.org_id)
  AND w.credits <> 0;

-- VO-08 : "L'alerte solde bas se déclenche dès la première connexion."
-- Le plan gratuit octroie 3 crédits et l'ancien seuil d'alerte était aussi 3,
-- donc tout nouvel inscrit était immédiatement "en dessous ou à" son seuil.
-- On abaisse le seuil à 1 (avertir sur le tout dernier crédit restant, avant
-- le passage à "épuisé"), plutôt que de changer l'opérateur de comparaison :
-- avec un seuil de 1, "solde <= seuil" avertit précisément au bon moment
-- (1 crédit restant) sans jamais se déclencher au moment de l'inscription
-- (3 crédits) ni faire doublon avec l'état "épuisé" (0 crédit), qui reste
-- une alerte séparée et prioritaire.

ALTER TABLE public.wallets ALTER COLUMN credits_alerte SET DEFAULT 1;
UPDATE public.wallets SET credits_alerte = 1 WHERE credits_alerte = 3;

-- VO-07 : "Une demande de crédits en attente ne génère aucune notification."
-- Les décisions (accordée/refusée), les octrois et le solde bas génèrent déjà
-- une notification (triggers existants). Il manquait l'accusé de réception
-- de la demande elle-même : le porteur de projet ne savait pas si sa demande
-- était bien partie.

CREATE OR REPLACE FUNCTION public.notify_credit_request_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications(user_id, org_id, kind, title, body, link, meta)
  VALUES (
    NEW.demandeur_id,
    NEW.org_id,
    'request_envoyee',
    'Demande de crédits envoyée',
    'Votre demande ' || NEW.pack || ' (' || NEW.credits || ' crédits) a bien été reçue et est en attente de traitement.',
    '/app/credits',
    jsonb_build_object('request_id', NEW.id, 'pack', NEW.pack, 'credits', NEW.credits)
  );
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.notify_credit_request_submitted() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_credit_request_submitted ON public.credit_requests;
CREATE TRIGGER trg_notify_credit_request_submitted
AFTER INSERT ON public.credit_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_credit_request_submitted();
