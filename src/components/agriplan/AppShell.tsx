import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Settings, LogOut, PlusCircle, Database, Coins, ShieldCheck, Inbox, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
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

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("vision-one.sidebar.collapsed") === "1";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("vision-one.sidebar.collapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      <aside
        className={`hidden flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div className={`flex h-16 items-center border-b border-sidebar-border ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}>
          {!collapsed && <BrandLogo size="sm" wordmarkClassName="text-lg font-bold" />}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent/50"
            title={`${collapsed ? "Développer" : "Réduire"} le menu (Ctrl+K)`}
            aria-label="Toggle sidebar"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map(({ to, label, Icon }) => {
            const active = location.pathname === to || location.pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to as any}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-2 rounded-md py-2 text-sm transition-colors ${
                  collapsed ? "justify-center px-2" : "px-3"
                } ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/50"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <Button
            variant="ghost"
            className={`w-full text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground ${
              collapsed ? "justify-center px-2" : "justify-start"
            }`}
            onClick={signOut}
            title={collapsed ? t("nav.signOut") : undefined}
          >
            <LogOut className={`h-4 w-4 ${collapsed ? "" : "mr-2"}`} />
            {!collapsed && t("nav.signOut")}
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