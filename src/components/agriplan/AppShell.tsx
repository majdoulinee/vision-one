import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Settings, LogOut, PlusCircle, Database, Coins, ShieldCheck, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { OrgSwitcher } from "./OrgSwitcher";
import { usePlatformRole } from "@/hooks/use-platform-role";
import { BrandLogo } from "./BrandLogo";
import { CreditBadge } from "./CreditBadge";
import { useLowCreditAlert } from "@/hooks/use-low-credit-alert";
import { NotificationBell } from "./NotificationBell";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: platformRole } = usePlatformRole();
  useLowCreditAlert();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav: Array<{ to: string; label: string; Icon: typeof LayoutDashboard }> = [
    { to: "/dashboard", label: t("nav.dashboard"), Icon: LayoutDashboard },
    { to: "/app/projects/new", label: t("nav2.newProject"), Icon: PlusCircle },
    { to: "/app/credits", label: t("nav2.credits") || "Mes crédits", Icon: Coins },
    { to: "/app/inbox", label: "Notifications", Icon: Inbox },
    { to: "/settings", label: t("nav.settings"), Icon: Settings },
  ];
  if (platformRole === "admin" || platformRole === "comite") {
    nav.push({ to: "/app/referentiel", label: t("nav2.referentiel"), Icon: Database });
  }
  if (platformRole === "admin") {
    nav.push({ to: "/app/admin/credits", label: t("nav2.adminCredits") || "Admin crédits", Icon: ShieldCheck });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <BrandLogo size="sm" wordmarkClassName="text-lg font-bold" />
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
            <CreditBadge />
            <NotificationBell />
            <LanguageSwitcher />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}