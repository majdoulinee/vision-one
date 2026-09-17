import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InverseWidget } from "@/components/landing/InverseWidget";
import { WeeksTrame } from "@/components/landing/WeeksTrame";
import { PdfMock } from "@/components/landing/PdfMock";
import { Reveal } from "@/components/landing/RevealOnScroll";
import { GAPS } from "@/components/landing/data";

// VO-12 : la version du référentiel affichée publiquement doit être lue
// depuis la base (fonction RPC lisible en anonyme), jamais citée en dur --
// sans quoi la landing continue d'affirmer une version qui peut ne plus
// correspondre à ce qui est réellement publié.
const FALLBACK_REF_VERSION = "2026.2";

function usePublicRefVersion() {
  const { data } = useQuery({
    queryKey: ["public-ref-version"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_published_ref_version");
      if (error) throw error;
      return data as string | null;
    },
    staleTime: 5 * 60_000,
  });
  return data ?? FALLBACK_REF_VERSION;
}

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: Landing,
  head: () => ({
    meta: [
      { title: "Vision One — Le business plan agricole que votre banque peut vérifier" },
      {
        name: "description",
        content:
          "Vision One génère un budget de campagne agricole semaine par semaine et un business plan bancable 5–10 ans, à partir d'un référentiel de normes versionné. Calcul 100 % déterministe : l'IA explique, ne chiffre jamais.",
      },
      { property: "og:title", content: "Vision One — Le business plan agricole que votre banque peut vérifier" },
      { property: "og:description", content: "Vision One génère un budget de campagne agricole semaine par semaine et un business plan bancable 5–10 ans, à partir d'un référentiel de normes versionné. Calcul 100 % déterministe : l'IA explique, ne chiffre jamais." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block ${className}`}
      style={{ fontFamily: "var(--font-serif)", fontSize: 21, fontWeight: 700, letterSpacing: ".04em" }}
    >
      Vision<span className="text-clay">One</span>
    </span>
  );
}

function Btn({
  variant = "ink",
  children,
  href,
  to,
  ...rest
}: {
  variant?: "ink" | "clay" | "ghost";
  children: React.ReactNode;
  href?: string;
  to?: string;
} & Record<string, any>) {
  const base =
    "inline-flex items-center gap-2 px-[22px] py-3 rounded-[4px] text-[14.5px] font-semibold border transition-[background,color,border-color,transform] duration-200 ease-out";
  const styles =
    variant === "clay"
      ? "bg-clay border-clay text-white hover:bg-ink hover:border-ink"
      : variant === "ghost"
      ? "bg-transparent border-line text-ink hover:bg-ink hover:text-parch hover:border-ink"
      : "bg-ink border-ink text-parch hover:bg-clay hover:border-clay hover:-translate-y-px";
  const cls = `${base} ${styles}`;
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>;
  return (
    <a href={href} className={cls} {...rest}>
      {children}
    </a>
  );
}

export default function Landing() {
  const refVersion = usePublicRefVersion();
  return (
    <div className="min-h-screen bg-parch text-ink grain-overlay">
      {/* ============ NAV ============ */}
      <nav
        className="sticky top-0 z-50 border-b border-line"
        style={{ background: "rgba(243,239,227,0.86)", backdropFilter: "blur(10px)" }}
      >
        <div className="mx-auto max-w-[1180px] px-8 h-[66px] flex items-center gap-8">
          <Wordmark />
          <div className="ml-auto flex items-center gap-[26px] text-[14.5px] text-mute">
            <a href="#methode" className="hidden md:inline hover:text-ink">Méthode</a>
            <a href="#preuve" className="hidden md:inline hover:text-ink">Preuve</a>
            <a href="#institutions" className="hidden md:inline hover:text-ink">Institutions</a>
            <a href="#tarifs" className="hidden md:inline hover:text-ink">Tarifs</a>
            <Link to="/auth" className="hidden md:inline hover:text-ink">Se connecter</Link>
            <Btn variant="ink" to="/auth" search={{ mode: "signup" }}>
              Pré-faisabilité gratuite
            </Btn>
          </div>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <header className="pt-[88px]">
        <div className="mx-auto max-w-[1180px] px-8">
          <div className="grid gap-16 items-start lg:grid-cols-[1.15fr_.85fr]">
            <div>
              <div className="mono-eyebrow text-clay mb-6">
                Projet → Profil de production → Normes → Budget → Business plan
              </div>
              <h1 style={{ fontSize: "clamp(40px,4.9vw,68px)" }}>
                Le business plan agricole que votre banque peut{" "}
                <em className="not-italic" style={{ fontStyle: "italic", color: "var(--clay)" }}>
                  vérifier
                </em>
                .
              </h1>
              <p className="mt-6 mb-8 text-[18.5px] text-mute max-w-[33em]">
                Un point sur la carte, une superficie, un capital. Vision One génère le budget de campagne{" "}
                <b className="text-ink font-semibold">semaine par semaine</b> et le business plan sur 5 à 10 ans,
                à partir d'un référentiel de normes vivant, alimenté par les données réelles de production au Maroc.
              </p>
              <div className="flex flex-wrap gap-3 items-center">
                <Btn variant="clay" to="/auth" search={{ mode: "signup" }}>
                  Tester la pré-faisabilité <span aria-hidden="true">→</span>
                </Btn>
                <Btn variant="ghost" href="#preuve">
                  Voir un document vérifié
                </Btn>
              </div>
              <p className="mt-[14px] text-[13px] text-mute">
                Gratuit, sans carte bancaire — moins de 5 minutes. Alternative : 40 000 à 80 000 MAD et plusieurs
                semaines de bureau d'études.
              </p>
            </div>

            <Reveal>
              <InverseWidget refVersion={refVersion} />
            </Reveal>
          </div>

          <Reveal>
            <WeeksTrame />
          </Reveal>
        </div>
      </header>

      {/* ============ MANIFESTE ============ */}
      <div className="mt-24 bg-ink text-parch relative overflow-hidden">
        <svg
          className="absolute -right-10 -top-8 w-[340px] opacity-10 z-[1]"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth=".6" />
          <path d="M50 14v72M14 50h72" stroke="currentColor" strokeWidth=".4" />
        </svg>
        <div className="mx-auto max-w-[1180px] px-8 py-[78px] relative z-[2]">
          <Reveal>
            <div className="mono-eyebrow text-ochre mb-6">La frontière IA</div>
            <p
              style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(30px,3.9vw,52px)", lineHeight: 1.14 }}
              className="max-w-[20em]"
            >
              Ici, l'intelligence artificielle explique, recommande et lit. Elle{" "}
              <span
                className="text-ochre"
                style={{ textDecoration: "underline", textDecorationThickness: "2px", textUnderlineOffset: "7px" }}
              >
                ne chiffre jamais
              </span>
              .
            </p>
            <p className="mt-6 max-w-[44em] text-[17px]" style={{ color: "#B4C0B2" }}>
              Chaque valeur d'un budget ou d'un business plan Vision One sort d'un moteur déterministe appliqué à un
              référentiel de normes versionné : provenance (données réelles agrégées Bee One, échantillon, période — ou
              comité d'experts), version, k-anonymat garanti (≥ 5). Le jour où un chargé de crédit vous demande d'où
              vient un rendement, vous avez la réponse. C'est la seule façon de rendre un document{" "}
              <em style={{ fontStyle: "italic" }}>bancable</em>.
            </p>
          </Reveal>
        </div>
      </div>

      {/* ============ MÉTHODE ============ */}
      <section id="methode" className="py-[104px]">
        <div className="mx-auto max-w-[1180px] px-8">
          <Reveal>
            <SectionHead
              step="01 — Méthode"
              title="Quatre étapes. Un document que personne ne peut contester à l'aveugle."
              sub="La plateforme n'est pas construite autour de « culture → variété → budget », mais autour du Profil de Production : une entité versionnée qui porte ses normes par hectare et par semaine, et son éligibilité par zone."
            />
          </Reveal>
          <Reveal>
            <div className="grid gap-px bg-line border border-line grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { n: "ÉTAPE 01", t: "Décrire le projet", d: "Un pin sur la carte résout votre zone agro-climatique (Souss, Loukkos, Gharb, Saïss, Haouz, Oriental, Doukkala). Superficie, capital, horizon, export ou marché local. C'est tout." },
                { n: "ÉTAPE 02", t: "Recevoir la recommandation", d: "3 à 5 profils scorés : investissement/ha, marge normative, délai de retour. Mapping profil × zone en trois états — optimal, éligible, exclu." },
                { n: "ÉTAPE 03", t: "Générer budget & BP", d: "Charges hebdomadaires (main-d'œuvre, intrants, irrigation, énergie, récolte, conditionnement), trésorerie semaine par semaine, puis BP 5–10 ans en trois scénarios : VAN, TRI, payback, point mort, coût/ha, coût/kg." },
                { n: "ÉTAPE 04", t: "Déposer le PDF vérifiable", d: "QR vers la page de preuve publique : version des normes, hypothèses forcées, empreinte SHA-256. Ce que vous modifiez reste visible — jamais caché." },
              ].map((c) => (
                <div key={c.n} className="bg-parch hover:bg-card transition-colors px-[26px] py-[30px]">
                  <div className="mono-eyebrow text-clay">{c.n}</div>
                  <h3 className="text-[21px] mt-[14px] mb-[10px]">{c.t}</h3>
                  <p className="text-[14.8px] text-mute leading-[1.62]">{c.d}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <div className="mx-auto max-w-[1180px] px-8">
        <div className="h-px bg-line" />
      </div>

      {/* ============ MOAT / RÉFÉRENTIEL ============ */}
      <section className="py-[104px]">
        <div className="mx-auto max-w-[1180px] px-8">
          <Reveal>
            <SectionHead
              step="02 — Le référentiel"
              title="Le moat : un référentiel vivant, versionné, tracé."
              sub="~25 % des superficies concernées au Maroc alimentent le référentiel via l'ERP Bee One. Les zones à faible échantillon sont complétées par un comité d'experts indépendant. Rien n'est inventé, rien n'est caché."
            />
          </Reveal>
          <div className="grid gap-14 items-center lg:grid-cols-2">
            <Reveal>
              <div className="border border-ink bg-card p-7 hard-shadow">
                <div className="grid grid-cols-2 gap-3.5">
                  <Node title="Bee One" sub="Données réelles agrégées" />
                  <Node title="Comité d'experts" sub="Complétion & calibration" />
                </div>
                <Arrows />
                <div className="border border-ink bg-ink text-parch p-[18px] text-center">
                  <b style={{ fontFamily: "var(--font-serif)", fontSize: 17, display: "block", marginBottom: 4 }}>
                    RÉFÉRENTIEL NORMES & PROFILS
                  </b>
                  <span className="mono-eyebrow text-ochre" style={{ fontSize: 11.5, letterSpacing: ".08em" }}>
                    v{refVersion} — k-anonymat ≥ 5
                  </span>
                </div>
                <Arrows />
                <div className="grid grid-cols-2 gap-3.5">
                  <Node title="Génération" sub="Budget · BP · Pré-faisa" />
                  <Node title="Contre-expertise" sub="Écarts vs norme (V2)" />
                </div>
                <Arrows />
                <div className="bg-clay text-white border border-clay p-4 text-center font-medium text-[13px]">
                  PDF bancable vérifiable
                </div>
              </div>
            </Reveal>
            <Reveal>
              <ul className="list-none">
                {[
                  ["~25 %", "des superficies fruits & légumes au Maroc", "alimentent le référentiel via Bee One."],
                  ["ha × sem", "la maille native", "Chaque norme est stockée par hectare et par semaine — pas par mois."],
                  ["7 zones", "agro-climatiques", "Souss-Massa, Loukkos, Gharb, Saïss, Haouz, Oriental, Doukkala."],
                  [`v${refVersion}`, "versionné, tracé", "Chaque document cite la version des normes qui l'a produit."],
                  ["N ≥ 5", "k-anonymat garanti", "Aucune ferme identifiable, jamais."],
                ].map(([k, b, p]) => (
                  <li
                    key={k}
                    className="py-[14px] border-t border-line grid grid-cols-[80px_1fr] gap-3 text-[15px] text-mute"
                  >
                    <span className="text-clay" style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 12 }}>
                      {k}
                    </span>
                    <span>
                      <b className="text-ink font-semibold">{b}. </b>
                      {p}
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ PREUVE ============ */}
      <section id="preuve" className="bg-parch-2 py-[104px]">
        <div className="mx-auto max-w-[1180px] px-8">
          <div className="grid gap-14 items-center lg:grid-cols-[0.95fr_1.05fr]">
            <Reveal>
              <PdfMock />
            </Reveal>
            <Reveal>
              <div className="mono-eyebrow text-clay mb-4">03 — La preuve</div>
              <h2 style={{ fontSize: "clamp(28px,3.3vw,42px)" }}>
                Un document qui se vérifie tout seul.
              </h2>
              <p className="mt-4 text-mute text-[17px] max-w-[38em]">
                Chaque PDF Vision One porte un QR code vers une page de preuve publique et une empreinte SHA-256. Toute
                modification est instantanément détectée. Les hypothèses forcées par le porteur sont listées noir sur
                blanc, sur le document et sur la page publique.
              </p>
              <ol className="mt-6 list-none">
                {[
                  ["Le porteur exporte", "budget ou BP, calcul déterministe, hypothèses horodatées."],
                  ["Le PDF s'imprime", "avec QR et SHA-256 en pied de page."],
                  ["Il l'envoie à sa banque", "un lien public, pas un fichier de plus à archiver."],
                  ["La banque scanne", "provenance, version, écarts vs norme — en 30 secondes."],
                  ["Le référentiel s'enrichit", "chaque campagne suivie renforce la norme."],
                ].map(([b, p], i) => (
                  <li
                    key={b}
                    className="pl-10 py-[11px] relative text-[15.5px] text-mute border-b border-line"
                  >
                    <span
                      className="absolute left-0 top-[13px] text-sky"
                      style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600 }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <b className="text-ink font-semibold">{b}. </b>
                    {p}
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ SEGMENTS ============ */}
      <section id="institutions" className="py-[104px]">
        <div className="mx-auto max-w-[1180px] px-8">
          <Reveal>
            <SectionHead
              step="04 — Pour qui"
              title="Quatre segments. Un même moteur déterministe."
              sub="Chaque profil utilisateur trouve un job-to-be-done précis. Vision One ne fait pas un peu tout pour tout le monde."
            />
          </Reveal>
          <Reveal>
            <div className="grid gap-px bg-line border border-line grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { job: "« J'ai un capital. Dites-moi quoi faire, et si c'est rentable. »", who: "Nouvel investisseur", desc: "Mode inversé : capital → profils atteignables → pré-faisabilité chiffrée en 5 minutes.", tag: "PLG" },
                { job: "« Mon banquier me demande un business plan. »", who: "Agriculteur-investisseur", desc: "Un budget de campagne et un BP 5–10 ans, avec la version des normes en pied de page.", tag: "PLG" },
                { job: "« Je veux comparer 40 projets sur les mêmes règles. »", who: "Groupe agricole / Consulting", desc: "Multi-projet, benchmark inter-fermes, contre-expertise sur BP soumis (V2).", tag: "SALES" },
                { job: "« Ce dossier est-il crédible ? »", who: "Banques, assureurs, publics", desc: "Page /verify publique, écarts vs norme de zone, score de risque documenté.", tag: "SALES" },
              ].map((s) => (
                <div key={s.who} className="bg-parch px-6 py-8 relative overflow-hidden">
                  <span
                    className="absolute top-0 right-0 bg-ink text-parch px-[9px] py-1"
                    style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600 }}
                  >
                    {s.tag}
                  </span>
                  <p
                    className="text-clay mb-[14px] leading-[1.35]"
                    style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18 }}
                  >
                    {s.job}
                  </p>
                  <h3 className="text-[16px] font-semibold" style={{ fontFamily: "var(--font-sans)", letterSpacing: 0 }}>
                    {s.who}
                  </h3>
                  <p className="text-[14px] text-mute mt-[10px]">{s.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ CONTRE-EXPERTISE ============ */}
      <section className="bg-ink text-parch py-[104px]">
        <div className="mx-auto max-w-[1180px] px-8">
          <Reveal>
            <div className="grid gap-10 mb-13 items-start" style={{ gridTemplateColumns: "200px 1fr" }}>
              <div className="mono-eyebrow text-ochre pt-2">05 — Contre-expertise</div>
              <div>
                <h2 className="text-white" style={{ fontSize: "clamp(28px,3.3vw,42px)" }}>
                  Ouvrez un BP concurrent. Lisez ses écarts en une phrase.
                </h2>
                <p className="mt-4 max-w-[38em] text-[17px]" style={{ color: "#9FAE9D" }}>
                  Pour les banques, les assureurs et les organismes publics : Vision One compare les hypothèses d'un BP
                  soumis aux normes de la zone concernée, avec la taille d'échantillon en clair (V2 en cours).
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal>
            <div className="border" style={{ borderColor: "rgba(255,255,255,.16)", background: "rgba(255,255,255,.04)" }}>
              <div
                className="grid px-[22px] py-4 mono-eyebrow"
                style={{ gridTemplateColumns: "1.4fr 1fr 1fr 90px", gap: 16, color: "#8C9C8A", borderBottom: "1px solid rgba(255,255,255,.1)" }}
              >
                <span>Hypothèse</span>
                <span>Déclaré</span>
                <span>Norme de zone</span>
                <span className="text-right">Écart</span>
              </div>
              {GAPS.map((g) => (
                <div
                  key={g.assumption}
                  className="grid px-[22px] py-4 items-center text-[14.5px]"
                  style={{ gridTemplateColumns: "1.4fr 1fr 1fr 90px", gap: 16, borderBottom: "1px solid rgba(255,255,255,.1)" }}
                >
                  <span>{g.assumption}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13.5 }}>{g.declared}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13.5 }}>
                    {g.norm} <span style={{ color: "#8C9C8A" }}>· {g.sample}</span>
                  </span>
                  <span
                    className="text-right"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      fontSize: 13,
                      color: g.severity === "hi" ? "#E2705A" : g.severity === "md" ? "#D9A521" : "#7FBF8E",
                    }}
                  >
                    {g.score}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-[18px] flex-wrap">
              <div className="flex-1 min-w-[220px] h-2 relative" style={{ background: "rgba(255,255,255,.12)" }}>
                <div
                  className="absolute inset-0"
                  style={{ right: "29%", background: "linear-gradient(90deg,#7FBF8E,#D9A521,#E2705A)" }}
                />
              </div>
              <b style={{ fontFamily: "var(--font-serif)", fontSize: 26 }}>71 / 100</b>
              <p className="text-[15px]" style={{ color: "#9FAE9D" }}>
                Rendement optimiste, prix agressif — TRI probablement surestimé de 5 à 8 points.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ TARIFS ============ */}
      <section id="tarifs" className="py-[104px]">
        <div className="mx-auto max-w-[1180px] px-8">
          <Reveal>
            <SectionHead
              step="06 — Tarifs"
              title="On facture la profondeur et la traçabilité. Jamais la modification."
              sub="Le cœur récurrent du modèle, c'est le suivi du budget de campagne. Tout le reste est ponctuel ou institutionnel."
            />
          </Reveal>
          <Reveal>
            <div className="grid gap-px bg-line border border-line grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {[
                { lab: "PRÉ-FAISABILITÉ", amt: "Gratuit", u: "Sans carte bancaire", li: ["Recommandation scorée", "Marge normative par ha", "3–5 profils comparés"], cta: "Commencer", star: false },
                { lab: "BUDGET PONCTUEL", amt: "1 crédit", small: " / doc", u: "Un budget de campagne complet", li: ["Semaine par semaine", "3 scénarios", "PDF vérifiable inclus"], cta: "Générer", star: false },
                { lab: "BUSINESS PLAN COMPLET", amt: "3 crédits", small: " / doc", u: "BP bancable 5–10 ans", li: ["Semaine par semaine", "3 scénarios", "PDF vérifiable inclus"], cta: "Générer", star: false },
                { lab: "BUDGET DE CAMPAGNE", amt: "190 MAD", small: " /ha/an", u: "Re-forecast illimité pendant la campagne", li: ["Suivi hebdomadaire", "Alerte trésorerie", "Export à la demande"], cta: "S'abonner", star: true, badge: "CŒUR DU MODÈLE — RÉCURRENT" },
                { lab: "PACK CONSULTANT", amt: "Sur demande", u: "Multi-projet, benchmark", li: ["Portefeuille", "Comparaison inter-fermes", "Marque blanche (V2)"], cta: "Nous contacter", star: false, contact: "Pack consultant" },
                { lab: "GROUPE AGRICOLE", amt: "Sur demande", u: "Multi-entités, consolidation", li: ["Rôles & permissions", "Consolidation groupe", "SLA dédié"], cta: "Nous contacter", star: false, contact: "Groupe agricole" },
                { lab: "INSTITUTIONNEL", amt: "Sur demande", u: "Banques, assureurs, publics", li: ["Contre-expertise (V2)", "Accès référentiel", "API vérification"], cta: "Nous contacter", star: false, contact: "Institutionnel" },
              ].map((p) => (
                <div
                  key={p.lab}
                  className={`px-[26px] py-8 flex flex-col ${p.star ? "bg-card -mt-[3px]" : "bg-parch"}`}
                  style={p.star ? { borderTop: "3px solid var(--clay)" } : undefined}
                >
                  {p.badge ? (
                    <span
                      className="inline-block bg-clay text-white px-2 py-[3px] -mb-1 self-start"
                      style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: ".14em" }}
                    >
                      {p.badge}
                    </span>
                  ) : null}
                  <div className="mono-eyebrow text-mute mt-2">{p.lab}</div>
                  <div className="mt-4 mb-0.5" style={{ fontFamily: "var(--font-serif)", fontSize: 40, fontWeight: 600 }}>
                    {p.amt}
                    {p.small ? (
                      <small
                        className="text-mute"
                        style={{ fontSize: 15, fontFamily: "var(--font-sans)", fontWeight: 400 }}
                      >
                        {p.small}
                      </small>
                    ) : null}
                  </div>
                  <div className="text-[13px] text-mute min-h-[34px]">{p.u}</div>
                  <ul className="list-none my-5 text-[14px] text-mute">
                    {p.li.map((l) => (
                      <li key={l} className="py-[7px] pl-[18px] relative">
                        <span className="absolute left-0 text-clay">—</span>
                        {l}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto">
                    {p.contact ? (
                      <Btn
                        variant="ghost"
                        href={`mailto:contact@agridataconsulting.ma?subject=${encodeURIComponent("Vision One — " + p.contact)}`}
                      >
                        {p.cta}
                      </Btn>
                    ) : (
                      <Btn variant={p.star ? "clay" : "ghost"} to="/auth" search={{ mode: "signup" }}>
                        {p.cta}
                      </Btn>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ ÉCOSYSTÈME ============ */}
      <section className="py-[104px]">
        <div className="mx-auto max-w-[1180px] px-8">
          <Reveal>
            <SectionHead
              step="07 — Écosystème"
              title="Vision One planifie. Bee Lite suit. Bee One pilote."
              sub="Trois étages qui se parlent. Un même référentiel qui les relie."
            />
          </Reveal>
          <Reveal>
            <div className="grid gap-5 grid-cols-1 md:grid-cols-3 items-end">
              {[
                { n: "PLANIFIER", t: "Vision One", d: "Budget de campagne, business plan, PDF vérifiable.", pb: 26, dark: false },
                { n: "SUIVRE", t: "Bee Lite", d: "Journal de terrain simplifié pour la ferme en cours de campagne.", pb: 48, dark: false },
                { n: "PILOTER", t: "Bee One", d: "ERP agricole complet, source des données réelles qui alimentent le référentiel.", pb: 70, dark: true },
              ].map((s) => (
                <div
                  key={s.t}
                  className={`border p-[26px] ${s.dark ? "bg-ink text-parch border-ink" : "bg-card border-line"}`}
                  style={{ paddingBottom: s.pb }}
                >
                  <span
                    className={`mono-eyebrow block mb-3 ${s.dark ? "text-ochre" : "text-clay"}`}
                  >
                    {s.n}
                  </span>
                  <h3 className="text-[22px] mb-2">{s.t}</h3>
                  <p className={`text-[14px] ${s.dark ? "" : "text-mute"}`} style={s.dark ? { color: "#A9B8A7" } : undefined}>
                    {s.d}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ CTA FINAL ============ */}
      <section id="final" className="text-center py-[120px]">
        <div className="mx-auto max-w-[1180px] px-8">
          <Reveal>
            <h2
              className="mx-auto mb-[22px]"
              style={{ fontSize: "clamp(34px,4.6vw,60px)", maxWidth: "14em" }}
            >
              Commencez par une pré-faisabilité. Payez le jour où vous <em style={{ fontStyle: "italic", color: "var(--clay)" }}>signez</em>.
            </h2>
            <p className="mx-auto max-w-[34em] mb-8 text-[17px] text-mute">
              5 minutes, sans carte bancaire. Vous repartez avec 3 profils scorés et la marge normative par hectare — assez pour décider si un projet mérite un vrai business plan.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Btn variant="clay" to="/auth" search={{ mode: "signup" }}>
                Pré-faisabilité gratuite <span aria-hidden="true">→</span>
              </Btn>
              <Btn variant="ghost" to="/auth">Se connecter</Btn>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-line py-11 text-[13.5px] text-mute">
        <div className="mx-auto max-w-[1180px] px-8 flex gap-7 flex-wrap items-center">
          <Wordmark className="text-[17px]" />
          <span>Vision One — Planification financière agricole vérifiable · AGRIDATA Consulting.</span>
          <div className="ml-auto flex gap-6">
            <a href="#methode" className="hover:text-ink">Méthode</a>
            <a href="#preuve" className="hover:text-ink">Preuve</a>
            <a href="#tarifs" className="hover:text-ink">Tarifs</a>
            <Link to="/mentions-legales" className="hover:text-ink">Mentions légales</Link>
            <Link to="/auth" className="hover:text-ink">Connexion</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ step, title, sub }: { step: string; title: string; sub: string }) {
  return (
    <div className="grid gap-10 items-start mb-13" style={{ gridTemplateColumns: "200px 1fr" }}>
      <div className="mono-eyebrow text-clay pt-2">{step}</div>
      <div>
        <h2 style={{ fontSize: "clamp(28px,3.3vw,42px)" }} className="max-w-[16em]">
          {title}
        </h2>
        <p className="mt-4 text-mute max-w-[38em] text-[17px]">{sub}</p>
      </div>
    </div>
  );
}

function Node({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="border border-line bg-white p-3 text-center">
      <div className="font-medium text-[13px]">{title}</div>
      <div className="mono-eyebrow text-mute mt-1" style={{ fontSize: 10 }}>{sub}</div>
    </div>
  );
}

function Arrows() {
  return (
    <div className="flex justify-center text-line py-2" style={{ letterSpacing: ".5em", fontSize: 15 }}>
      ▼ ▼ ▼
    </div>
  );
}