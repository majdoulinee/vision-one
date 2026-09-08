import { Link } from "@tanstack/react-router";

const DEMO_DOC_ID = "63e2456e-b738-4a93-9e36-982cdbd82654";

export function PdfMock() {
  return (
    <Link
      to="/verify/$docId"
      params={{ docId: DEMO_DOC_ID }}
      className="relative block"
      aria-label="Voir le document de démonstration et sa vérification publique"
    >
      <div
        className="relative bg-white border border-line px-8 py-8 transition-transform duration-500 -rotate-[1.1deg] hover:rotate-0 hover:-translate-y-1"
        style={{ boxShadow: "0 30px 60px -30px rgba(18,33,26,.4)" }}
      >
        <div style={{ fontFamily: "var(--font-serif)", fontSize: 24 }}>Budget de campagne — démo</div>
        <div className="mt-1 mb-5 mono-eyebrow text-mute" style={{ fontSize: 12 }}>
          Vision One · normes v2026.2 · Souss-Massa · SHA-256 e0eb…eb5
        </div>
        <table className="w-full text-[13.5px]" style={{ borderCollapse: "collapse" }}>
          <tbody>
            {(
              [
                ["Superficie", "2,5 ha"],
                ["Profil", "Tomate sous serre (export)"],
                ["Rendement retenu", "120 000 kg/ha"],
                ["Prix export normatif", "4,50 MAD/kg", false],
                ["Prix export forcé", "4,80 MAD/kg", true],
                ["Durée de campagne", "30 semaines"],
                ["Marge campagne (2,5 ha)", "885 000 MAD"],
              ] as const
            ).map(([k, v, forced]) => (
              <tr key={String(k) + String(v)}>
                <td className="py-2 border-b border-dotted border-line text-mute">
                  {k}
                  {forced ? (
                    <span className="ml-2 text-clay" style={{ fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
                      ⟵ forcé, tracé
                    </span>
                  ) : null}
                </td>
                <td
                  className={`py-2 border-b border-dotted border-line text-right ${forced ? "text-clay" : "text-ink"}`}
                  style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}
                >
                  {v}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 mono-eyebrow text-mute" style={{ fontSize: 11 }}>
          Document de démonstration · cliquer pour voir sa vérification publique →
        </div>
      </div>
      {/* QR — vrai QR code, pointe vers la page de vérification de ce document */}
      <div className="absolute -right-6 -bottom-6 w-[104px] h-[104px] bg-white border border-ink grid place-items-center hard-shadow-ink p-2">
        <img
          src="/demo/verify-qr.png"
          alt="QR code de vérification du document de démonstration"
          width={84}
          height={84}
          className="w-full h-full object-contain"
        />
      </div>
    </Link>
  );
}
