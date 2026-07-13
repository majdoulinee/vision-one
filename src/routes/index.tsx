import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/agriplan/LanguageSwitcher";
import { Sprout, ShieldCheck, QrCode, Database, Users, GitBranch, FileCheck2 } from "lucide-react";

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
            <Button
              asChild
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Link to="/auth" search={{ mode: "signup" }}>
                {t("landing.ctaFree")}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
          {t("landing.hero")}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">{t("landing.sub")}</p>
        <div className="mt-10 flex justify-center">
          <Button
            asChild
            size="lg"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Link to="/auth" search={{ mode: "signup" }}>
              {t("landing.ctaFree")}
            </Link>
          </Button>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight">{t("landing.howTitle")}</h2>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { title: t("landing.step1Title"), desc: t("landing.step1Desc") },
              { title: t("landing.step2Title"), desc: t("landing.step2Desc") },
              { title: t("landing.step3Title"), desc: t("landing.step3Desc") },
            ].map((s) => (
              <div key={s.title} className="rounded-lg border bg-card p-6">
                <h3 className="font-semibold text-primary">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Référentiel */}
      <section className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight">{t("landing.refTitle")}</h2>
          <p className="mx-auto mt-4 max-w-3xl text-center text-muted-foreground">
            {t("landing.refDesc")}
          </p>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { Icon: Database, title: t("landing.refBeeOne"), desc: t("landing.refBeeOneDesc") },
              { Icon: Users, title: t("landing.refCom"), desc: t("landing.refComDesc") },
              { Icon: GitBranch, title: t("landing.refVersion"), desc: t("landing.refVersionDesc") },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="rounded-lg border bg-card p-6">
                <Icon className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PDF vérifiable */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 px-4 py-20 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{t("landing.pdfTitle")}</h2>
            <p className="mt-4 text-muted-foreground">{t("landing.pdfDesc")}</p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> SHA-256</span>
              <span className="inline-flex items-center gap-2"><QrCode className="h-4 w-4 text-primary" /> QR code</span>
              <span className="inline-flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-primary" /> /verify</span>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="relative aspect-[3/4] w-64 rounded-lg border bg-card p-4 shadow-sm">
              <div className="h-2 w-16 rounded bg-primary/70" />
              <div className="mt-3 space-y-1.5">
                {[90, 75, 82, 60, 88, 70, 78].map((w, i) => (
                  <div key={i} className="h-1.5 rounded bg-muted" style={{ width: `${w}%` }} />
                ))}
              </div>
              <div className="mt-4 h-16 rounded bg-muted" />
              <div className="mt-3 space-y-1.5">
                {[85, 65, 72].map((w, i) => (
                  <div key={i} className="h-1.5 rounded bg-muted" style={{ width: `${w}%` }} />
                ))}
              </div>
              <div className="absolute bottom-4 end-4 rounded bg-background p-1.5 shadow ring-1 ring-border">
                <QrCode className="h-10 w-10 text-primary" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tarifs */}
      <section className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight">{t("landing.pricing")}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center italic text-muted-foreground">
            « {t("landing.pricingIntro")} »
          </p>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: t("landing.planFreeTitle"), price: t("landing.planFreePrice"), desc: t("landing.planFreeDesc"), highlight: true },
              { title: t("landing.planActTitle"), price: t("landing.planActPrice"), desc: t("landing.planActDesc") },
              { title: t("landing.planSubTitle"), price: t("landing.planSubPrice"), desc: t("landing.planSubDesc") },
              { title: t("landing.planEnterpriseTitle"), price: t("landing.planEnterprisePrice"), desc: t("landing.planEnterpriseDesc") },
            ].map((p) => (
              <div
                key={p.title}
                className={`flex flex-col rounded-lg border bg-card p-6 ${
                  p.highlight ? "border-accent ring-1 ring-accent/40" : ""
                }`}
              >
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <div className={`mt-3 text-2xl font-bold ${p.highlight ? "text-accent" : "text-primary"}`}>
                  {p.price}
                </div>
                <p className="mt-3 flex-1 text-sm text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <span>{t("landing.footerLegal")}</span>
          <LanguageSwitcher />
        </div>
      </footer>
    </div>
  );
}