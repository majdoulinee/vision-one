import * as React from "react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ComiteColumn = {
  key: string;
  header: React.ReactNode;
  align?: "start" | "end" | "center";
  className?: string;
  /** largeur fixe optionnelle (ex: "w-6") */
  width?: string;
};

type Props = {
  columns: ComiteColumn[];
  minWidth?: number;
  children: React.ReactNode;
  className?: string;
};

/**
 * Tableau standard du comité — en-tête mono-eyebrow, fond parch/muted,
 * alignement contrôlé par colonne. Corps rendu par l'appelant via <TableRow/>.
 */
export function ComiteTable({ columns, minWidth = 700, children, className }: Props) {
  return (
    <Table style={{ minWidth }} className={className}>
      <TableHeader className="bg-muted/50">
        <TableRow>
          {columns.map((c) => (
            <TableHead
              key={c.key}
              className={cn(
                "mono-eyebrow",
                c.align === "end" && "text-end",
                c.align === "center" && "text-center",
                c.width,
                c.className,
              )}
            >
              {c.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  );
}