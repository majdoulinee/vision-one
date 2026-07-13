import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./use-session";

export function usePlatformRole() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["platform-role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("platform_role")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.platform_role as "user" | "admin" | "comite") ?? "user";
    },
  });
}