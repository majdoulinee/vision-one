// Load referentiel from DB and hydrate into engine-domain types.
import { supabase } from "@/integrations/supabase/client";
import { hydrateProfil } from "./curves";
import type { Mapping, MappingStatut, Profil, Zone } from "./types";

export async function loadReferentiel(refVersion = "2026.2"): Promise<{
  profils: Profil[];
  mappings: Mapping[];
  zones: Zone[];
}> {
  const [pp, pzm, zn] = await Promise.all([
    supabase.from("profils_production").select("code, name, data").eq("ref_version", refVersion),
    supabase.from("profil_zone_mappings").select("profile_code, zone_code, quality").eq("ref_version", refVersion),
    supabase.from("zones").select("code, name, data").eq("ref_version", refVersion),
  ]);
  if (pp.error) throw pp.error;
  if (pzm.error) throw pzm.error;
  if (zn.error) throw zn.error;

  const profils = (pp.data ?? []).map((r: any) => hydrateProfil(r));
  const mappings: Mapping[] = (pzm.data ?? []).map((r: any) => ({
    profil_code: r.profile_code,
    zone_code: r.zone_code,
    statut: (r.quality === "deconseille" ? "exclu" : r.quality) as MappingStatut,
  }));
  const zones: Zone[] = (zn.data ?? []).map((r: any) => ({
    code: r.code,
    label: r.name,
    bbox_lng_min: r.data?.bbox_lng_min,
    bbox_lat_min: r.data?.bbox_lat_min,
    bbox_lng_max: r.data?.bbox_lng_max,
    bbox_lat_max: r.data?.bbox_lat_max,
  }));
  return { profils, mappings, zones };
}