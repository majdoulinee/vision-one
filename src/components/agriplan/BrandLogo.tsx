import iconAsset from "@/assets/vision-one-icon.png.asset.json";

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
        src={iconAsset.url}
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