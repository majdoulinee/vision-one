import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FilterOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type Props<T extends string> = {
  options: FilterOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
};

/**
 * Barre de filtres segmentée — design system Vision One.
 * Utilise `Button` en variantes `ink` (actif) / `outline-ink` (inactif).
 */
export function FilterChips<T extends string>({ options, value, onChange, className }: Props<T>) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {options.map((o) => (
        <Button
          key={o.value}
          size="sm"
          variant={value === o.value ? "ink" : "outline-ink"}
          onClick={() => onChange(o.value)}
          className="mono-eyebrow"
        >
          {o.label}
          {typeof o.count === "number" && (
            <span className="ml-1 opacity-70 tabular-nums">{o.count}</span>
          )}
        </Button>
      ))}
    </div>
  );
}