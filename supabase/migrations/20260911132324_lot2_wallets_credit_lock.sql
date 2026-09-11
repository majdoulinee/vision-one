-- VO-22 (Lot 2 "Opposable") : wallets.credits ne doit jamais pouvoir être
-- modifié par un UPDATE direct (ex. un owner qui s'auto-crédite depuis la
-- console du navigateur via PostgREST) — seules les fonctions SECURITY
-- DEFINER qui écrivent aussi au grand livre (consume_credits, refund_credits,
-- grant_credits) sont autorisées à le faire. Elles s'auto-autorisent pour la
-- transaction en cours via un paramètre de session local ; tout autre chemin
-- (y compris un simple UPDATE ... SET credits = ... exécuté à la main) est
-- rejeté par ce trigger.

CREATE OR REPLACE FUNCTION public.wallets_block_direct_credit_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.credits IS DISTINCT FROM OLD.credits
     AND coalesce(current_setting('app.allow_credit_mutation', true), '') <> 'on' THEN
    RAISE EXCEPTION 'direct_credit_mutation_forbidden' USING ERRCODE = '42501',
      HINT = 'wallets.credits ne peut être modifié que via consume_credits / refund_credits / grant_credits.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_wallets_block_direct_credit_update ON public.wallets;
CREATE TRIGGER trg_wallets_block_direct_credit_update
  BEFORE UPDATE OF credits ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.wallets_block_direct_credit_update();

CREATE OR REPLACE FUNCTION public.consume_credits(p_org_id uuid, p_action text, p_ref_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cost int; v_active boolean; v_credits int; v_autorise boolean; v_new int; v_entry uuid;
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT cout, actif INTO v_cost, v_active FROM public.credit_pricing WHERE action = p_action;
  IF v_cost IS NULL THEN RAISE EXCEPTION 'unknown_action:%', p_action; END IF;
  IF NOT v_active THEN RAISE EXCEPTION 'action_disabled:%', p_action; END IF;
  IF v_cost = 0 THEN RETURN NULL; END IF;

  SELECT credits, autorise_negatif INTO v_credits, v_autorise
    FROM public.wallets WHERE org_id = p_org_id FOR UPDATE;
  IF v_credits IS NULL THEN RAISE EXCEPTION 'wallet_not_found'; END IF;
  IF v_credits < v_cost AND NOT v_autorise THEN
    RAISE EXCEPTION 'insufficient_credits:solde=% requis=%', v_credits, v_cost;
  END IF;
  v_new := v_credits - v_cost;
  PERFORM set_config('app.allow_credit_mutation', 'on', true);
  UPDATE public.wallets SET credits = v_new, updated_at = now() WHERE org_id = p_org_id;
  INSERT INTO public.credit_ledger(org_id, delta, solde_apres, type, action, ref_id, auteur_id)
    VALUES (p_org_id, -v_cost, v_new, 'consommation', p_action, p_ref_id, auth.uid())
    RETURNING id INTO v_entry;
  RETURN v_entry;
END $function$;

CREATE OR REPLACE FUNCTION public.refund_credits(p_ledger_id uuid, p_motif text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.credit_ledger%ROWTYPE; v_new int; v_entry uuid;
BEGIN
  SELECT * INTO r FROM public.credit_ledger WHERE id = p_ledger_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF r.type <> 'consommation' THEN RAISE EXCEPTION 'not_a_consumption'; END IF;
  IF r.auteur_id <> auth.uid() AND NOT public.has_platform_role('admin'::public.platform_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.credit_ledger
     WHERE type = 'remboursement' AND action = r.action
       AND org_id = r.org_id AND COALESCE(ref_id::text,'') = COALESCE(r.ref_id::text,'')
       AND at > r.at
  ) THEN RETURN NULL; END IF;
  PERFORM set_config('app.allow_credit_mutation', 'on', true);
  UPDATE public.wallets SET credits = credits + (-r.delta), updated_at = now()
    WHERE org_id = r.org_id RETURNING credits INTO v_new;
  INSERT INTO public.credit_ledger(org_id, delta, solde_apres, type, action, ref_id, auteur_id, motif)
    VALUES (r.org_id, -r.delta, v_new, 'remboursement', r.action, r.ref_id, auth.uid(), p_motif)
    RETURNING id INTO v_entry;
  RETURN v_entry;
END $function$;

CREATE OR REPLACE FUNCTION public.grant_credits(p_org_id uuid, p_delta integer, p_motif text, p_type text DEFAULT 'octroi_admin'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_new int; v_entry uuid;
BEGIN
  IF NOT public.has_platform_role('admin'::public.platform_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_delta = 0 THEN RAISE EXCEPTION 'delta_zero'; END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 10 THEN RAISE EXCEPTION 'motif_required_min_10'; END IF;
  IF p_type NOT IN ('octroi_admin','ajustement','achat_en_ligne') THEN RAISE EXCEPTION 'bad_type'; END IF;
  PERFORM set_config('app.allow_credit_mutation', 'on', true);
  UPDATE public.wallets SET credits = credits + p_delta, updated_at = now()
    WHERE org_id = p_org_id RETURNING credits INTO v_new;
  IF v_new IS NULL THEN RAISE EXCEPTION 'wallet_not_found'; END IF;
  INSERT INTO public.credit_ledger(org_id, delta, solde_apres, type, action, auteur_id, motif)
    VALUES (p_org_id, p_delta, v_new, p_type, NULL, auth.uid(), p_motif)
    RETURNING id INTO v_entry;
  INSERT INTO public.audit_log(org_id, user_id, action, entity_type, entity_id, meta)
    VALUES (p_org_id, auth.uid(), 'credits_'||p_type, 'organization', p_org_id::text,
            jsonb_build_object('delta', p_delta, 'motif', p_motif, 'ledger_id', v_entry));
  RETURN v_entry;
END $function$;
