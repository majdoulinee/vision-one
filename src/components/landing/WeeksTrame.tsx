import { WEEK_BARS } from "./data";

export function WeeksTrame() {
  return (
    <div className="mt-16 pb-2">
      <div className="flex items-baseline justify-between mb-3">
        <span className="mono-eyebrow text-mute">Budget de campagne — maille native : la semaine</span>
        <span className="mono-eyebrow text-mute">Charges · Trésorerie · Pic de récolte</span>
      </div>
      <div
        className="flex items-end gap-[3px] h-[120px] border-b border-ink"
        aria-hidden="true"
      >
        {WEEK_BARS.map((b, i) => {
          const color =
            b.kind === "peak" ? "bg-clay opacity-100" :
            b.kind === "cash" ? "bg-ochre opacity-90" :
            "bg-ink-2 opacity-[0.16]";
          return (
            <span
              key={i}
              className={`flex-1 origin-bottom scale-y-0 ${color}`}
              style={{
                height: `${b.h}%`,
                animation: "bar-grow .8s cubic-bezier(.2,.8,.2,1) forwards",
                animationDelay: `${i * 14}ms`,
              }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-mute" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <span>S01 — Préparation</span>
        <span>S18 — Plantation</span>
        <span>S31 — Pic de récolte</span>
        <span>S52</span>
      </div>
    </div>
  );
}