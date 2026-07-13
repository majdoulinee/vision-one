// Reproduces the reference HTML: gaussian charge curve, S28–S34 peak (clay),
// every 9th week highlighted as a cash spike (ochre), else base.
function curve(i: number) {
  const g = (m: number, s: number) => Math.exp(-Math.pow(i - m, 2) / (2 * s * s));
  return 0.18 + 0.55 * g(18, 5) + 1.0 * g(31, 7) + 0.25 * g(5, 3);
}

const BARS = Array.from({ length: 52 }, (_, k) => {
  const i = k + 1;
  const h = Math.max(6, Math.min(100, curve(i) * 90));
  const kind: "peak" | "cash" | "base" =
    i >= 28 && i <= 34 ? "peak" : i % 9 === 0 ? "cash" : "base";
  return { i, h, kind };
});

export function WeeksTrame() {
  return (
    <div className="mt-[74px] pb-[10px]">
      <div className="flex items-baseline justify-between mb-[10px]">
        <span className="mono-eyebrow text-mute">Budget de campagne — maille native : la semaine</span>
        <span className="mono-eyebrow text-mute">Charges · Trésorerie · Pic de récolte</span>
      </div>
      <div
        className="flex items-end gap-[3px] h-[120px] border-b border-ink"
        aria-hidden="true"
      >
        {BARS.map((b) => {
          const bg =
            b.kind === "peak"
              ? "var(--clay)"
              : b.kind === "cash"
              ? "var(--ochre)"
              : "var(--ink-2)";
          const opacity = b.kind === "peak" ? 1 : b.kind === "cash" ? 0.9 : 0.16;
          return (
            <span
              key={b.i}
              className="flex-1 block origin-bottom"
              style={{
                height: `${b.h}%`,
                background: bg,
                opacity,
                transform: "scaleY(0)",
                animation: "bar-grow .8s cubic-bezier(.2,.8,.2,1) forwards",
                animationDelay: `${b.i * 14}ms`,
              }}
            />
          );
        })}
      </div>
      <div
        className="flex justify-between mt-2 text-mute"
        style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
      >
        <span>S01 — Préparation</span>
        <span>S18 — Plantation</span>
        <span>S31 — Pic de récolte</span>
        <span>S52</span>
      </div>
    </div>
  );
}