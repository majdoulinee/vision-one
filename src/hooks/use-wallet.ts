import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "./use-current-org";

export type Wallet = {
  org_id: string;
  credits: number;
  plan: string;
  credits_alerte: number;
  autorise_negatif: boolean;
  updated_at: string;
};

export function useWallet() {
  const { current } = useCurrentOrg();
  return useQuery({
    queryKey: ["wallet", current?.org_id],
    enabled: !!current,
    queryFn: async (): Promise<Wallet | null> => {
      const { data, error } = await supabase
        .from("wallets")
        .select("org_id, credits, plan, credits_alerte, autorise_negatif, updated_at")
        .eq("org_id", current!.org_id)
        .maybeSingle();
      if (error) throw error;
      return data as Wallet | null;
    },
  });
}

export type PricingRow = { action: string; label: string; cout: number; actif: boolean };

export function usePricing() {
  return useQuery({
    queryKey: ["credit_pricing"],
    queryFn: async (): Promise<PricingRow[]> => {
      const { data, error } = await supabase
        .from("credit_pricing")
        .select("action,label,cout,actif")
        .order("cout", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PricingRow[];
    },
    staleTime: 60_000,
  });
}

export function useCost(action: string): number | null {
  const { data } = usePricing();
  const row = data?.find((r) => r.action === action);
  return row ? row.cout : null;
}