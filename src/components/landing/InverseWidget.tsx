import { useMemo, useState } from "react";
import { ZONES, computeReco, type ZoneKey } from "./data";

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

export function InverseWidget({ refVersion = "2026.2" }: { refVersion?: string }) {
  const [capitalStr, setCapitalStr] = useState("5 000 000");
  const [zone, setZone] = useState<ZoneKey>("Souss-Massa");

  const capital = useMemo(() => {
    const digits = capitalStr.replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  }, [capitalStr]);

  const results = useMemo(() => computeReco(capital, zone), [capital, zone]);

  return (
    <div className="border border-ink bg-card hard-shadow overflow-hidden">
      <div className="flex items-center justify-between px-[18px] py-[13px] bg-ink text-parch">
        <span className="mono-eyebrow text-ochre" style={{ fontSize: 10.5 }}>Mode inversé</span>
        <span className="mono-eyebrow text-parch/70" style={{ fontSize: 10.5 }}>Moteur déterministe</span>
      </div>
      <div className="px-5 py-[22px]">
        <div className="mb-4" style={{ fontFamily: "var(--font-serif)", fontSize: 22 }}>
          J'ai un capital de…
        </div>
        <label className="flex items-center gap-[10px] border-b-2 border-ink pb-2">
          <input
            value={capitalStr}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^\d]/g, "");
              setCapitalStr(digits ? new Intl.NumberFormat("fr-FR").format(parseInt(digits, 10)) : "");
            }}
            inputMode="numeric"
            aria-label="Capital disponible"
            className="flex-1 border-none bg-transparent outline-none w-full text-ink"
            style={{ fontFamily: "var(--font-mono)", fontSize: 30, fontWeight: 600 }}
          />
          <span className="text-mute" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600 }}>MAD</span>
        </label>
        <div className="flex flex-wrap gap-1.5 mt-4" role="group" aria-label="Zone agro-climatique">
          {ZONES.map((z) => {
            const active = zone === z;
            return (
              <button
                key={z}
                type="button"
                aria-pressed={active}
                onClick={() => setZone(z)}
                className={`text-[12.5px] px-[11px] py-[5px] rounded-full border transition ${
                  active
                    ? "bg-ink text-parch border-ink"
                    : "bg-white border-line text-ink hover:border-ink"
                }`}
              >
                {z}
              </button>
            );
          })}
        </div>
        <div className="mt-[18px] border-t border-dashed border-line pt-[14px] min-h-[210px]">
          {results.length === 0 ? (
            <div
              className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 py-[11px] opacity-0"
              style={{ animation: "rise .5s forwards" }}
            >
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 600 }}>
                Capital insuffisant
              </div>
              <div className="col-span-2 text-mute" style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                Aucun profil atteignable sur au moins 0,5 ha dans cette zone.
              </div>
            </div>
          ) : (
            results.map((r, i) => (
              <div
                key={r.name}
                className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 py-[11px] border-b border-dotted border-line last:border-b-0 opacity-0"
                style={{ animation: "rise .5s forwards", animationDelay: `${i * 70}ms` }}
              >
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 600 }}>{r.name}</div>
                <div className="text-clay" style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>
                  {r.ha.toFixed(1)} ha atteignables
                </div>
                <div className="col-span-2 text-mute" style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                  {fmt(r.inv)} MAD/ha · marge normative {r.marge}% · retour {r.pb.toString().replace(".", ",")} ans
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="px-5 py-3 bg-parch-2 text-xs text-mute flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-ochre flex-none" />
        Aucun chiffre généré par une IA — normes v{refVersion}, provenance tracée.
      </div>
    </div>
  );
}