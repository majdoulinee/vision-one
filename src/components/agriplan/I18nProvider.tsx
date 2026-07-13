import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { applyDirection } from "@/lib/i18n";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  useEffect(() => {
    applyDirection(i18n.language);
    const handler = (lng: string) => applyDirection(lng);
    i18n.on("languageChanged", handler);
    return () => {
      i18n.off("languageChanged", handler);
    };
  }, [i18n]);
  return <>{children}</>;
}