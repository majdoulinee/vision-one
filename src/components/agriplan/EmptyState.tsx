import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

/**
 * VO-31 : état vide générique orienté action, à réutiliser partout où une
 * liste peut être vide (projets, consultants, invitations…) plutôt que de
 * laisser un simple message texte sans possibilité d'agir.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void; href?: string; to?: string };
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 py-10 text-center ${className}`}>
      {Icon && (
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && (
        action.to ? (
          <Button size="sm" className="mt-2" asChild>
            <Link to={action.to as any}>{action.label}</Link>
          </Button>
        ) : action.href ? (
          <Button size="sm" className="mt-2" asChild>
            <a href={action.href}>{action.label}</a>
          </Button>
        ) : (
          <Button size="sm" className="mt-2" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}
