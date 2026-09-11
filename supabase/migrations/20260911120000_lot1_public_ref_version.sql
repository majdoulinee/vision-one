-- VO-12 : "La version de normes 'v2026.2' est affirmée publiquement, absente du produit."
-- La landing (page publique, non authentifiée) citait cette version en dur.
-- On expose, via une fonction SECURITY DEFINER étroite, uniquement le numéro
-- de version publié le plus récent (aucune autre colonne de ref_versions),
-- pour que la landing l'affiche en le lisant réellement depuis la base.

CREATE OR REPLACE FUNCTION public.get_published_ref_version()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT version FROM public.ref_versions ORDER BY published_at DESC LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_published_ref_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_ref_version() TO anon, authenticated;
