
-- notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_created_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx ON public.notifications(user_id) WHERE read_at IS NULL;

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_platform_role('admin'::public.platform_role));

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- No INSERT policy: inserts only via SECURITY DEFINER triggers below.

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger: on credit_requests status change → notify demandeur
CREATE OR REPLACE FUNCTION public.notify_credit_request_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.statut = OLD.statut THEN RETURN NEW; END IF;
  IF NEW.statut NOT IN ('accordee','refusee') THEN RETURN NEW; END IF;

  INSERT INTO public.notifications(user_id, org_id, kind, title, body, link, meta)
  VALUES (
    NEW.demandeur_id,
    NEW.org_id,
    CASE WHEN NEW.statut = 'accordee' THEN 'request_accordee' ELSE 'request_refusee' END,
    CASE WHEN NEW.statut = 'accordee'
         THEN 'Demande de crédits accordée'
         ELSE 'Demande de crédits refusée' END,
    CASE WHEN NEW.statut = 'accordee'
         THEN 'Votre demande ' || NEW.pack || ' (' || NEW.credits || ' crédits) a été accordée.'
         ELSE COALESCE(NEW.motif_refus, 'Votre demande a été refusée.') END,
    '/app/credits/requests/' || NEW.id::text,
    jsonb_build_object('request_id', NEW.id, 'pack', NEW.pack, 'credits', NEW.credits)
  );
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.notify_credit_request_decision() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_notify_credit_request_decision
AFTER UPDATE ON public.credit_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_credit_request_decision();

-- Trigger: on credit_ledger insert (octroi_admin / remboursement) → notify all org members
CREATE OR REPLACE FUNCTION public.notify_credit_ledger_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  v_title text;
  v_body text;
BEGIN
  IF NEW.type NOT IN ('octroi_admin','remboursement') THEN RETURN NEW; END IF;

  IF NEW.type = 'octroi_admin' THEN
    v_title := 'Crédits octroyés (+' || NEW.delta || ')';
    v_body := COALESCE(NEW.motif, 'Un octroi de crédits a été ajouté à votre organisation.');
  ELSE
    v_title := 'Crédits remboursés (+' || NEW.delta || ')';
    v_body := COALESCE(NEW.motif, 'Un remboursement de crédits a été effectué.');
  END IF;

  FOR m IN SELECT user_id FROM public.org_members WHERE org_id = NEW.org_id LOOP
    INSERT INTO public.notifications(user_id, org_id, kind, title, body, link, meta)
    VALUES (
      m.user_id, NEW.org_id, 'credits_' || NEW.type,
      v_title, v_body, '/app/credits',
      jsonb_build_object('ledger_id', NEW.id, 'delta', NEW.delta, 'solde_apres', NEW.solde_apres)
    );
  END LOOP;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.notify_credit_ledger_entry() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_notify_credit_ledger_entry
AFTER INSERT ON public.credit_ledger
FOR EACH ROW EXECUTE FUNCTION public.notify_credit_ledger_entry();

-- Trigger: on wallets update → notify all members when crossing alert threshold (dedup per bucket)
CREATE OR REPLACE FUNCTION public.notify_wallet_low_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  v_threshold int;
  v_new_bucket text;
  v_old_bucket text;
  v_title text;
  v_body text;
  v_kind text;
BEGIN
  v_threshold := COALESCE(NEW.credits_alerte, 3);

  v_new_bucket := CASE
    WHEN NEW.credits <= 0 THEN 'empty'
    WHEN NEW.credits <= v_threshold THEN 'low'
    ELSE 'ok' END;
  v_old_bucket := CASE
    WHEN OLD.credits <= 0 THEN 'empty'
    WHEN OLD.credits <= COALESCE(OLD.credits_alerte, 3) THEN 'low'
    ELSE 'ok' END;

  IF v_new_bucket = v_old_bucket OR v_new_bucket = 'ok' THEN RETURN NEW; END IF;

  IF v_new_bucket = 'empty' THEN
    v_kind := 'credit_empty';
    v_title := 'Solde de crédits épuisé';
    v_body := 'Demandez un pack pour continuer à générer des documents.';
  ELSE
    v_kind := 'low_credit';
    v_title := 'Solde bas : ' || NEW.credits || ' crédit(s) restant(s)';
    v_body := 'Seuil d''alerte : ' || v_threshold || '. Anticipez votre prochaine demande.';
  END IF;

  FOR m IN SELECT user_id FROM public.org_members WHERE org_id = NEW.org_id LOOP
    -- Dedup: skip if a notification of same kind exists for this user+org in last 24h
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = m.user_id AND org_id = NEW.org_id AND kind = v_kind
        AND created_at > now() - interval '24 hours'
    ) THEN
      INSERT INTO public.notifications(user_id, org_id, kind, title, body, link, meta)
      VALUES (
        m.user_id, NEW.org_id, v_kind, v_title, v_body, '/app/credits',
        jsonb_build_object('credits', NEW.credits, 'threshold', v_threshold)
      );
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.notify_wallet_low_credit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_notify_wallet_low_credit
AFTER UPDATE OF credits ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.notify_wallet_low_credit();
