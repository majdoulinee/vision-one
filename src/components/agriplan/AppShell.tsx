import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Sprout, LayoutDashboard, Settings, LogOut, PlusCircle, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { OrgSwitcher } from "./OrgSwitcher";
import { usePlatformRole } from "@/hooks/use-platform-role";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: platformRole } = usePlatformRole();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav: Array<{ to: string; label: string; Icon: typeof LayoutDashboard }> = [
    { to: "/dashboard", label: t("nav.dashboard"), Icon: LayoutDashboard },
    { to: "/app/projects/new", label: t("nav2.newProject"), Icon: PlusCircle },
    { to: "/settings", label: t("nav.settings"), Icon: Settings },
  ];
  if (platformRole === "admin" || platformRole === "comite") {
    nav.push({ to: "/app/referentiel", label: t("nav2.referentiel"), Icon: Database });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
          <Sprout className="h-6 w-6 text-sidebar-primary" />
          <span className="text-lg font-bold">AGRIPLAN</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map(({ to, label, Icon }) => {
            const active = location.pathname === to || location.pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to as any}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t("nav.signOut")}
          </Button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
          <OrgSwitcher />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}