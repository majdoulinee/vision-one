import { Link, useLocation, Navigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { usePlatformRole } from "@/hooks/use-platform-role";
import { Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TAB_ROUTES = [
  { to: "/app/comite/propositions", key: "propositions" },
  { to: "/app/comite/bee-one", key: "beeOne" },
  { to: "/app/comite/versions", key: "versions" },
  { to: "/app/comite/publish", key: "publish" },
] as const;

const PIPELINE_KEYS = ["brouillon", "soumise", "valideeComite", "approbationAdmin", "publiee"] as const;

export function ComiteShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { data: role, isPending, isFetching } = usePlatformRole();
  const loc = useLocation();
  if (isPending || isFetching || role === undefined) {
    return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }
  if (role !== "comite" && role !== "admin") return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-ink bg-ink text-parch overflow-hidden hard-shadow-ink">
        <div className="flex flex-wrap items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2 font-serif text-base">
            <Landmark className="h-4 w-4 text-ochre" />
            <span className="tracking-tight">Vision One</span>
            <Badge variant="ochre">{t("comite.expertCommittee")}</Badge>
          </div>
          <nav className="flex flex-wrap items-center gap-1 ml-auto">
            {TAB_ROUTES.map((tab) => {
              const active = loc.pathname.startsWith(tab.to);
              return (
                <Link
                  key={tab.to}
                  to={tab.to as any}
                  className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                    active
                      ? "bg-parch/15 text-parch"
                      : "text-parch/70 hover:bg-parch/10 hover:text-parch"
                  }`}
                >
                  {t(`comite.tabs.${tab.key}`)}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-t border-parch/10 bg-parch/5">
          {PIPELINE_KEYS.map((k, i) => (
            <span key={k} className="flex items-center gap-2">
              <Badge variant="ochre-soft">{t(`comite.pipeline.${k}`)}</Badge>
              {i < PIPELINE_KEYS.length - 1 && <span className="text-parch/40">→</span>}
            </span>
          ))}
          <span className="ml-auto font-serif italic text-parch/70 text-[12px]">
            {t("comite.doubleValidation")}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
