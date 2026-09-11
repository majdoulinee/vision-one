-- VO-24 (Lot 2 "Opposable") : cabler l'ecran d'import du referentiel dans le
-- circuit de gouvernance brouillon -> soumise -> validee comite -> approuvee
-- admin -> publiee, deja decrit par l'UI (comite.propositions/publish,
-- admin.referentiel) mais jamais reellement operable :
--   1. ref_lots et ref_propositions n'avaient AUCUNE policy d'ecriture (RLS
--      activee, 0 ligne en base) : la creation de lot/proposition depuis
--      l'ecran comite echouait silencieusement en production.
--   2. comite_publish_lot() referencait une colonne ref_versions.publiee qui
--      n'existe pas dans le schema reel : toute publication echouait.
--   3. Rien, nulle part, n'ecrivait jamais dans zones / profils_production /
--      profil_zone_mappings a partir d'une proposition approuvee : la
--      publication ne faisait que changer des statuts.
--
-- Teste en transaction (BEGIN ... ROLLBACK, jamais commis) : cycle complet
-- brouillon -> soumise -> validee_comite -> approuvee_admin -> publie, avec
-- verification de la materialisation dans zones / profils_production /
-- profil_zone_mappings et de ref_versions / get_published_ref_version().

create policy ref_lots_write_editor on public.ref_lots
  for all using (is_referentiel_editor()) with check (is_referentiel_editor());

create policy ref_propositions_write_editor on public.ref_propositions
  for all using (is_referentiel_editor()) with check (is_referentiel_editor());

create or replace function public.comite_publish_lot(p_lot_id uuid, p_note text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_version text;
  v_pending int;
  v_total int;
  v_email text;
  r record;
begin
  if not public.has_platform_role('comite'::public.platform_role) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_note is null or length(trim(p_note)) < 10 then raise exception 'note_required_min_10'; end if;

  select count(*) into v_pending from public.ref_propositions
   where lot_id = p_lot_id and statut <> 'approuvee_admin';
  if v_pending > 0 then raise exception 'lot_has_% propositions non approuvees', v_pending; end if;

  select count(*) into v_total from public.ref_propositions where lot_id = p_lot_id;
  if v_total = 0 then raise exception 'lot_empty'; end if;

  select version_cible into v_version from public.ref_lots where id = p_lot_id for update;
  if v_version is null then raise exception 'lot_not_found'; end if;

  select email into v_email from public.profiles where id = auth.uid();

  -- La ligne ref_versions doit exister avant toute ecriture zones/
  -- profils_production/profil_zone_mappings (FK ref_version -> version).
  insert into public.ref_versions(version, notes, published_at, created_by, publiee_par, note_publication, publiee_le)
    values (v_version, p_note, now(), auth.uid(), coalesce(v_email, auth.uid()::text), p_note, now())
  on conflict (version) do update set
    published_at = now(), note_publication = excluded.note_publication,
    publiee_le = now(), publiee_par = excluded.publiee_par;

  -- Materialise chaque proposition approuvee dans les tables live du
  -- referentiel. Convention de cle_norme portee par l'ecran d'import :
  --   zone:<code>            -> upsert public.zones
  --   profil:<code>          -> upsert public.profils_production
  --   mapping:<profil>/<zone> -> upsert public.profil_zone_mappings
  --   normes:<profil_code>   -> fusion jsonb dans profils_production.data
  --      (le profil doit deja exister en base : on revise les normes d'un
  --      profil deja publie dans une version anterieure)
  -- Toute autre cle_norme (usage manuel historique, ex. "besoins_eau_hebdo")
  -- reste tracee dans ref_propositions mais ne materialise rien.
  for r in select * from public.ref_propositions where lot_id = p_lot_id loop
    if r.cle_norme like 'zone:%' then
      insert into public.zones(code, name, ref_version, data)
        values (
          split_part(r.cle_norme, ':', 2),
          coalesce(r.nouvelle_valeur->>'name', split_part(r.cle_norme, ':', 2)),
          v_version, coalesce(r.nouvelle_valeur->'data', '{}'::jsonb)
        )
      on conflict (code) do update set
        name = excluded.name, ref_version = excluded.ref_version, data = excluded.data, updated_at = now();
    elsif r.cle_norme like 'profil:%' then
      insert into public.profils_production(code, name, ref_version, data)
        values (
          split_part(r.cle_norme, ':', 2),
          coalesce(r.nouvelle_valeur->>'name', split_part(r.cle_norme, ':', 2)),
          v_version, coalesce(r.nouvelle_valeur->'data', '{}'::jsonb)
        )
      on conflict (code) do update set
        name = excluded.name, ref_version = excluded.ref_version, data = excluded.data, updated_at = now();
    elsif r.cle_norme like 'mapping:%' then
      insert into public.profil_zone_mappings(profile_code, zone_code, quality, ref_version)
        values (
          split_part(split_part(r.cle_norme, ':', 2), '/', 1),
          split_part(split_part(r.cle_norme, ':', 2), '/', 2),
          (r.nouvelle_valeur->>'quality')::public.mapping_quality,
          v_version
        )
      on conflict (profile_code, zone_code, ref_version) do update set quality = excluded.quality;
    elsif r.cle_norme like 'normes:%' then
      update public.profils_production
         set data = data || r.nouvelle_valeur, ref_version = v_version, updated_at = now()
       where code = split_part(r.cle_norme, ':', 2);
      if not found then
        raise exception 'normes_profil_introuvable:% (le profil doit deja etre publie)', split_part(r.cle_norme, ':', 2);
      end if;
    end if;
  end loop;

  update public.ref_propositions set statut = 'publiee' where lot_id = p_lot_id;
  update public.ref_lots set statut = 'publie', publie_le = now(), publie_par = auth.uid(),
    note_version = p_note where id = p_lot_id;

  insert into public.audit_log(user_id, action, entity_type, entity_id, meta)
  values (auth.uid(), 'ref_lot_published', 'ref_lot', p_lot_id::text,
    jsonb_build_object('version', v_version, 'note', p_note));

  return v_version;
end $function$;
