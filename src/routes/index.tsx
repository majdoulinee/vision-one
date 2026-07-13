import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/agriplan/LanguageSwitcher";
import { Sprout, ShieldCheck, LineChart, QrCode } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Sprout className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight">{t("app.name")}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">{t("landing.signIn")}</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth" search={{ mode: "signup" }}>
                {t("landing.cta")}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
          {t("landing.hero")}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">{t("landing.sub")}</p>
        <div className="mt-10 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth" search={{ mode: "signup" }}>
              {t("landing.cta")}
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 pb-24 sm:grid-cols-3">
        {[
          { Icon: LineChart, title: "Budget → Business Plan", desc: "Un flux continu et cohérent." },
          { Icon: ShieldCheck, title: "Calculs déterministes", desc: "Chiffres reproductibles et auditables." },
          { Icon: QrCode, title: "PDF vérifiable", desc: "Empreinte SHA-256 et QR code intégré." },
        ].map(({ Icon, title, desc }) => (
          <div key={title} className="rounded-lg border bg-card p-6">
            <Icon className="h-8 w-8 text-primary" />
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
