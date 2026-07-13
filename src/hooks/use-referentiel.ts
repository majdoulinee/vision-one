import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadReferentiel } from "@/engines/loader";

export function usePublishedVersion() {
  return useQuery({
    queryKey: ["ref-version-published"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ref_versions")
        .select("version, notes, published_at")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}

export function useReferentiel(version: string | undefined) {
  return useQuery({
    queryKey: ["referentiel", version],
    enabled: !!version,
    queryFn: () => loadReferentiel(version as string),
    staleTime: 60_000,
  });
}