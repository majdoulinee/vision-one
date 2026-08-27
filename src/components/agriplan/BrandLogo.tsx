import iconAsset from "@/assets/vision-one-icon.png.asset.json";

// Fallback local icon for dev environments where the Lovable-hosted asset
// (/__l5e/assets-v1/...) isn't reachable (e.g. plain `vite dev` locally).
const iconSrc = "/favicon.png";

type Size = "sm" | "md" | "lg";
const px: Record<Size, number> = { sm: 24, md: 32, lg: 48 };

export function BrandLogo({
  size = "md",
  withWordmark = true,
  wordmarkClassName = "text-lg font-bold tracking-tight",
  className = "",
}: {
  size?: Size;
  withWordmark?: boolean;
  wordmarkClassName?: string;
  className?: string;
}) {
  const s = px[size];
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={iconSrc}
        alt="Vision One"
        width={s}
        height={s}
        style={{ width: s, height: s }}
        className="shrink-0"
      />
      {withWordmark ? <span className={wordmarkClassName}>Vision One</span> : null}
    </span>
  );
}