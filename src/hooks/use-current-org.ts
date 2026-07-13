import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./use-session";

const LS_KEY = "agriplan.currentOrgId";

export type OrgMembership = {
  org_id: string;
  role: "owner" | "admin" | "editor" | "member" | "viewer";
  org: {
    id: string;
    name: string;
    type: string;
    country: string | null;
  };
};

export function canWriteRole(role: OrgMembership["role"] | undefined): boolean {
  return role === "owner" || role === "admin" || role === "editor" || role === "member";
}

export function useMyOrganizations() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["my-orgs", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<OrgMembership[]> => {
      const { data, error } = await supabase
        .from("org_members")
        .select("org_id, role, org:organizations!inner(id,name,type,country)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as unknown as OrgMembership[];
    },
  });
}

export function useCurrentOrg() {
  const { data: orgs, isLoading } = useMyOrganizations();
  const [currentId, setCurrentId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(LS_KEY);
  });

  useEffect(() => {
    if (!orgs || orgs.length === 0) return;
    if (!currentId || !orgs.find((o) => o.org_id === currentId)) {
      const first = orgs[0].org_id;
      setCurrentId(first);
      window.localStorage.setItem(LS_KEY, first);
    }
  }, [orgs, currentId]);

  const switchOrg = (id: string) => {
    setCurrentId(id);
    window.localStorage.setItem(LS_KEY, id);
  };

  const current = orgs?.find((o) => o.org_id === currentId) ?? null;
  return { orgs: orgs ?? [], current, currentId, switchOrg, isLoading };
}