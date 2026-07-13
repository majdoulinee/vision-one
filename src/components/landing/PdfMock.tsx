export function PdfMock() {
  return (
    <div className="relative">
      <div
        className="relative bg-white border border-line px-8 py-8 transition-transform duration-500 -rotate-[1.1deg] hover:rotate-0 hover:-translate-y-1"
        style={{ boxShadow: "0 30px 60px -30px rgba(18,33,26,.4)" }}
      >
        <div style={{ fontFamily: "var(--font-serif)", fontSize: 24 }}>Budget de campagne 2026-B</div>
        <div className="mt-1 mb-5 mono-eyebrow text-mute" style={{ fontSize: 12 }}>
          Vision One · normes v2026.2 · Souss-Massa · SHA-256 4b8a…c1
        </div>
        <table className="w-full text-[13.5px]" style={{ borderCollapse: "collapse" }}>
          <tbody>
            {[
              ["Superficie", "12 ha"],
              ["Profil", "Avocatier Hass 4×2"],
              ["Rendement moyen", "31 200 kg/ha"],
              ["Prix vente moyen", "12,80 MAD/kg", false],
              ["Prix vente forcé", "14,50 MAD/kg", true],
              ["Coût main-d'œuvre", "1 520 h/ha/an"],
              ["Marge campagne", "824 400 MAD"],
            ].map(([k, v, forced]) => (
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
      </div>
      {/* QR */}
      <div
        className="absolute -right-6 -bottom-6 w-[104px] h-[104px] bg-white border border-ink grid place-items-center hard-shadow-ink"
        aria-hidden="true"
      >
        <svg width="70" height="70" viewBox="0 0 70 70">
          <rect width="70" height="70" fill="#fff" />
          {/* faux QR pattern */}
          {Array.from({ length: 12 }).map((_, r) =>
            Array.from({ length: 12 }).map((_, c) => {
              const on = (r * 7 + c * 3 + (r * c) % 5) % 3 === 0;
              return on ? <rect key={`${r}-${c}`} x={4 + c * 5} y={4 + r * 5} width="4" height="4" fill="#12211A" /> : null;
            }),
          )}
          {/* corners */}
          <rect x="4" y="4" width="14" height="14" fill="none" stroke="#12211A" strokeWidth="2" />
          <rect x="52" y="4" width="14" height="14" fill="none" stroke="#12211A" strokeWidth="2" />
          <rect x="4" y="52" width="14" height="14" fill="none" stroke="#12211A" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}