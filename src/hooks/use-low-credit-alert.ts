import { useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useWallet } from "./use-wallet";

export function useLowCreditAlert() {
  const { data } = useWallet();
  const navigate = useNavigate();

  useEffect(() => {
    if (!data) return;
    const { org_id, credits, credits_alerte } = data;
    const threshold = credits_alerte ?? 3;
    if (credits > threshold) return;

    const bucket = credits === 0 ? "empty" : "low";
    const key = `vision-one.lowCreditToast.${org_id}.${bucket}.${credits}`;
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");

    const action = {
      label: "Voir mes crédits",
      onClick: () => navigate({ to: "/app/credits" }),
    };

    if (credits === 0) {
      toast.error("Solde de crédits épuisé", {
        description: "Demandez un pack pour générer de nouveaux documents.",
        action,
      });
    } else {
      toast.warning(`Solde bas : ${credits} crédit${credits > 1 ? "s" : ""} restant${credits > 1 ? "s" : ""}`, {
        description: `Seuil d'alerte : ${threshold}.`,
        action,
      });
    }
  }, [data, navigate]);
}