
CREATE TYPE public.platform_role AS ENUM ('user', 'admin', 'comite');
CREATE TYPE public.org_type AS ENUM ('ferme', 'cooperative', 'banque', 'assureur', 'organisme_public', 'groupe', 'autre');
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'editor', 'viewer');
CREATE TYPE public.locale_code AS ENUM ('fr', 'ar', 'en');
CREATE TYPE public.wallet_plan AS ENUM ('free', 'pro');
CREATE TYPE public.mapping_quality AS ENUM ('optimal', 'possible', 'deconseille');
CREATE TYPE public.project_mode AS ENUM ('projet', 'capital');
CREATE TYPE public.document_type AS ENUM ('budget', 'business_plan', 'prefaisabilite');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  locale public.locale_code NOT NULL DEFAULT 'fr',
  platform_role public.platform_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type public.org_type NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orgs_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- org_members
CREATE TABLE public.org_members (
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = _org_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org_id UUID, _roles public.org_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = _org_id AND user_id = auth.uid() AND role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.has_platform_role(_role public.platform_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND platform_role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_referentiel_editor()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND platform_role IN ('admin', 'comite'));
$$;

-- Policies: profiles
CREATE POLICY "profiles_select_self" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Policies: organizations
CREATE POLICY "orgs_select_member" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(id));
CREATE POLICY "orgs_insert_self" ON public.organizations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "orgs_update_admin" ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(id, ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY "orgs_delete_owner" ON public.organizations FOR DELETE TO authenticated
  USING (public.has_org_role(id, ARRAY['owner']::public.org_role[]));

-- Policies: org_members
CREATE POLICY "members_select_same_org" ON public.org_members FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "members_insert_admin" ON public.org_members FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY "members_update_admin" ON public.org_members FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY "members_delete_admin" ON public.org_members FOR DELETE TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner','admin']::public.org_role[]));

-- invitations
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.org_role NOT NULL DEFAULT 'viewer',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_select_org_admin" ON public.invitations FOR SELECT TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY "inv_insert_org_admin" ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner','admin']::public.org_role[]) AND invited_by = auth.uid());
CREATE POLICY "inv_delete_org_admin" ON public.invitations FOR DELETE TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner','admin']::public.org_role[]));

-- wallets
CREATE TABLE public.wallets (
  org_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan public.wallet_plan NOT NULL DEFAULT 'free',
  credits INTEGER NOT NULL DEFAULT 3 CHECK (credits >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "wallets_select_member" ON public.wallets FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "wallets_update_owner" ON public.wallets FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner']::public.org_role[]))
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner']::public.org_role[]));

-- ref_versions
CREATE TABLE public.ref_versions (
  version TEXT PRIMARY KEY,
  notes TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ref_versions TO authenticated;
GRANT ALL ON public.ref_versions TO service_role;
ALTER TABLE public.ref_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refv_select_auth" ON public.ref_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "refv_write_editor" ON public.ref_versions FOR ALL TO authenticated
  USING (public.is_referentiel_editor()) WITH CHECK (public.is_referentiel_editor());

-- zones
CREATE TABLE public.zones (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT,
  ref_version TEXT NOT NULL REFERENCES public.ref_versions(version),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zones TO authenticated;
GRANT ALL ON public.zones TO service_role;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_zones_updated_at BEFORE UPDATE ON public.zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "zones_select_auth" ON public.zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "zones_write_editor" ON public.zones FOR ALL TO authenticated
  USING (public.is_referentiel_editor()) WITH CHECK (public.is_referentiel_editor());

-- profils_production
CREATE TABLE public.profils_production (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  ref_version TEXT NOT NULL REFERENCES public.ref_versions(version),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profils_production TO authenticated;
GRANT ALL ON public.profils_production TO service_role;
ALTER TABLE public.profils_production ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profprod_updated_at BEFORE UPDATE ON public.profils_production
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "pp_select_auth" ON public.profils_production FOR SELECT TO authenticated USING (true);
CREATE POLICY "pp_write_editor" ON public.profils_production FOR ALL TO authenticated
  USING (public.is_referentiel_editor()) WITH CHECK (public.is_referentiel_editor());

-- profil_zone_mappings
CREATE TABLE public.profil_zone_mappings (
  profile_code TEXT NOT NULL REFERENCES public.profils_production(code) ON DELETE CASCADE,
  zone_code TEXT NOT NULL REFERENCES public.zones(code) ON DELETE CASCADE,
  quality public.mapping_quality NOT NULL,
  ref_version TEXT NOT NULL REFERENCES public.ref_versions(version),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_code, zone_code, ref_version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profil_zone_mappings TO authenticated;
GRANT ALL ON public.profil_zone_mappings TO service_role;
ALTER TABLE public.profil_zone_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pzm_select_auth" ON public.profil_zone_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "pzm_write_editor" ON public.profil_zone_mappings FOR ALL TO authenticated
  USING (public.is_referentiel_editor()) WITH CHECK (public.is_referentiel_editor());

-- projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  mode public.project_mode NOT NULL,
  capital NUMERIC,
  surface_ha NUMERIC,
  zone_code TEXT REFERENCES public.zones(code),
  profile_code TEXT REFERENCES public.profils_production(code),
  status TEXT NOT NULL DEFAULT 'draft',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "projects_select_member" ON public.projects FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "projects_insert_editor" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner','admin','editor']::public.org_role[]) AND created_by = auth.uid());
CREATE POLICY "projects_update_editor" ON public.projects FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner','admin','editor']::public.org_role[]))
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner','admin','editor']::public.org_role[]));
CREATE POLICY "projects_delete_admin" ON public.projects FOR DELETE TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner','admin']::public.org_role[]));

-- budgets
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ref_version TEXT NOT NULL REFERENCES public.ref_versions(version),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  overrides JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_budgets_updated_at BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "budgets_select_member" ON public.budgets FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "budgets_write_editor" ON public.budgets FOR ALL TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner','admin','editor']::public.org_role[]))
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner','admin','editor']::public.org_role[]));

-- business_plans
CREATE TABLE public.business_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ref_version TEXT NOT NULL REFERENCES public.ref_versions(version),
  scenarios JSONB NOT NULL DEFAULT '[]'::jsonb,
  hypotheses JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_plans TO authenticated;
GRANT ALL ON public.business_plans TO service_role;
ALTER TABLE public.business_plans ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_bp_updated_at BEFORE UPDATE ON public.business_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "bp_select_member" ON public.business_plans FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "bp_write_editor" ON public.business_plans FOR ALL TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner','admin','editor']::public.org_role[]))
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner','admin','editor']::public.org_role[]));

-- documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type public.document_type NOT NULL,
  source_id UUID,
  ref_version TEXT REFERENCES public.ref_versions(version),
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  overrides JSONB NOT NULL DEFAULT '[]'::jsonb,
  resume JSONB NOT NULL DEFAULT '{}'::jsonb,
  sha256 TEXT,
  storage_path TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_docs_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "docs_select_member" ON public.documents FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "docs_write_editor" ON public.documents FOR ALL TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner','admin','editor']::public.org_role[]))
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner','admin','editor']::public.org_role[]));

-- audit_log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_member" ON public.audit_log FOR SELECT TO authenticated
  USING (org_id IS NULL OR public.is_org_member(org_id));
CREATE POLICY "audit_insert_member" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (org_id IS NULL OR public.is_org_member(org_id)));

-- Signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, locale)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'locale')::public.locale_code, 'fr')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Org creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner') ON CONFLICT DO NOTHING;
  INSERT INTO public.wallets (org_id, plan, credits)
  VALUES (NEW.id, 'free', 3) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_org_created AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();
