import { useCurrentOrg } from "@/hooks/use-current-org";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Building2, ChevronDown } from "lucide-react";

export function OrgSwitcher() {
  const { orgs, current, switchOrg } = useCurrentOrg();
  if (!current) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Building2 className="h-4 w-4" />
          <span className="max-w-[160px] truncate">{current.org.name}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuLabel>Organisations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.map((o) => (
          <DropdownMenuItem key={o.org_id} onClick={() => switchOrg(o.org_id)}>
            <div className="flex flex-col">
              <span className="text-sm">{o.org.name}</span>
              <span className="text-xs text-muted-foreground">{o.role}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}