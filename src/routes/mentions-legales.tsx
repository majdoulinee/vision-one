import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/mentions-legales")({
  component: MentionsLegales,
  head: () => ({
    meta: [
      { title: "Mentions légales & confidentialité · Vision One" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function MentionsLegales() {
  return (
    <div className="min-h-screen bg-parch text-ink">
      <div className="mx-auto max-w-[760px] px-8 py-16">
        <Link to="/" className="text-sm text-clay hover:underline">← Retour à l'accueil</Link>

        <h1 className="mt-6 mb-2" style={{ fontFamily: "var(--font-serif)", fontSize: 34 }}>
          Mentions légales & confidentialité
        </h1>
        <p className="mb-8 text-sm text-mute">Dernière mise à jour : septembre 2026.</p>

        <div className="mb-10 border border-clay bg-clay/10 p-4 text-[14px] leading-relaxed">
          <b>Avertissement.</b> Vision One est un projet développé dans un cadre académique
          (stage / projet de fin d'études) et n'est pas, à ce stade, commercialisé auprès du
          public. Le contenu de cette page est une base générique fournie à titre d'exemple :
          il ne constitue pas un avis juridique et doit être relu, complété et validé par un
          professionnel du droit avant toute exploitation commerciale réelle de la plateforme —
          notamment pour la déclaration auprès de la Commission Nationale de contrôle de la
          protection des Données à caractère Personnel (CNDP, loi 09-08 au Maroc).
        </div>

        <Section title="Éditeur">
          <p>
            Ce site est édité dans le cadre d'un projet porté avec AGRIDATA Consulting.
            <br />
            Raison sociale, adresse et numéro d'identification : <i>à compléter avant toute mise en production réelle</i>.
            <br />
            Contact : <a className="text-clay hover:underline" href="mailto:contact@agridataconsulting.ma">contact@agridataconsulting.ma</a>
          </p>
        </Section>

        <Section title="Hébergement">
          <p>
            Le site est hébergé par Vercel Inc. La base de données et l'authentification sont
            gérées par Supabase. Ces prestataires peuvent traiter des données techniques
            (adresse IP, journaux de connexion) dans le cadre normal de leur service d'hébergement.
          </p>
        </Section>

        <Section title="Propriété intellectuelle">
          <p>
            L'ensemble des contenus, textes, méthodes de calcul et éléments visuels présents sur
            Vision One sont la propriété de leurs auteurs respectifs et ne peuvent être reproduits
            sans autorisation préalable.
          </p>
        </Section>

        <Section title="Données personnelles">
          <p className="mb-3">
            Vision One collecte les données nécessaires au fonctionnement du service : identité et
            email du compte, données d'organisation, données de projet et d'exploitation agricole
            saisies par l'utilisateur, ainsi que les journaux techniques d'usage. Ces données sont
            utilisées pour fournir le service (génération de budgets et business plans), assurer
            la sécurité du compte, et améliorer le référentiel agrégé (données anonymisées,
            k-anonymat ≥ 5 — voir la section « Le référentiel » de la page d'accueil).
          </p>
          <p>
            Conformément à la loi 09-08 relative à la protection des personnes physiques à l'égard
            du traitement des données à caractère personnel, vous disposez d'un droit d'accès, de
            rectification et de suppression de vos données. Pour l'exercer, contactez-nous à
            l'adresse ci-dessus.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            Vision One utilise uniquement les cookies et le stockage local strictement
            nécessaires au fonctionnement du site (session de connexion, préférence de langue).
            Aucun cookie publicitaire ou de traçage tiers n'est utilisé.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Pour toute question relative à ces mentions ou à vos données personnelles :{" "}
            <a className="text-clay hover:underline" href="mailto:contact@agridataconsulting.ma">contact@agridataconsulting.ma</a>
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2" style={{ fontFamily: "var(--font-serif)", fontSize: 20 }}>
        {title}
      </h2>
      <div className="text-[15px] leading-relaxed text-mute">{children}</div>
    </section>
  );
}
