import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "./use-current-org";

export function useConsultantLinksForClient() {
  const { data: org } = useCurrentOrg();
  return useQuery({
    queryKey: ["consultant_links_client", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultant_links")
        .select("*, consultant_org:organizations!consultant_links_consultant_org_id_fkey(name)")
        .eq("client_org_id", org!.id)
        .eq("statut", "actif");
      if (error) throw error;
      return data ?? [];
    },
  });
}
