import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type Props = {
  to?: string;
  onClick?: () => void;
  label?: string;
  className?: string;
};

/**
 * High-contrast back button for form/detail pages.
 * Fixes low-visibility ghost buttons on parchment background.
 */
export function BackButton({ to, onClick, label, className }: Props) {
  const { t } = useTranslation();
  const text = label ?? t("common.back");
  const classes = cn(
    "inline-flex items-center gap-2 rounded-md border border-line bg-parch-2/60 px-3 py-2 text-sm font-medium text-ink transition hover:bg-parch-2 hover:border-ink/30",
    className,
  );
  if (to) {
    return (
      <Link to={to} className={classes}>
        <ArrowLeft className="h-4 w-4" />
        <span>{text}</span>
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      <ArrowLeft className="h-4 w-4" />
      <span>{text}</span>
    </button>
  );
}