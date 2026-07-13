
-- Lot 1: aligner les enums sur la spec (ADD VALUE only — PG ne permet pas DROP VALUE)
-- Ajouter les valeurs manquantes; les anciennes valeurs restent mais ne seront plus exposées côté UI.

ALTER TYPE public.org_type ADD VALUE IF NOT EXISTS 'investisseur';
ALTER TYPE public.org_type ADD VALUE IF NOT EXISTS 'agriculteur';
ALTER TYPE public.org_type ADD VALUE IF NOT EXISTS 'consultant';

ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'member';

ALTER TYPE public.mapping_quality ADD VALUE IF NOT EXISTS 'eligible';
ALTER TYPE public.mapping_quality ADD VALUE IF NOT EXISTS 'exclu';

-- Colonnes manquantes sur ref_versions
ALTER TABLE public.ref_versions
  ADD COLUMN IF NOT EXISTS k_anonymat int DEFAULT 5,
  ADD COLUMN IF NOT EXISTS publiee_par text;

-- Trigger : à la création d'une organisation, créer le wallet(free, 3) s'il n'existe pas.
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

  RETURN NEW;
END;
$function$;

-- Attacher le trigger s'il ne l'est pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_organization_created'
  ) THEN
    CREATE TRIGGER on_organization_created
      AFTER INSERT ON public.organizations
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();
  END IF;
END $$;

-- Backfill : créer un wallet pour toute org existante qui n'en a pas
INSERT INTO public.wallets (org_id, plan, credits)
SELECT o.id, 'free'::public.wallet_plan, 3
FROM public.organizations o
LEFT JOIN public.wallets w ON w.org_id = o.id
WHERE w.org_id IS NULL;
