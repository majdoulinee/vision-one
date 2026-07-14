import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "./use-current-org";

export function useConsultantLinksForClient() {
  const { currentId } = useCurrentOrg();
  return useQuery({
    queryKey: ["consultant_links_client", currentId],
    enabled: !!currentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultant_links")
        .select("*, consultant_org:organizations!consultant_links_consultant_org_id_fkey(name)")
        .eq("client_org_id", currentId!)
        .order("accorde_le", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useConsultantLinksForConsultant() {
  const { currentId } = useCurrentOrg();
  return useQuery({
    queryKey: ["consultant_links_consultant", currentId],
    enabled: !!currentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultant_links")
        .select("*, client_org:organizations!consultant_links_client_org_id_fkey(id,name,type,country)")
        .eq("consultant_org_id", currentId!)
        .order("accorde_le", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
