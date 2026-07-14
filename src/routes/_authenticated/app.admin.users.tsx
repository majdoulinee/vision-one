import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/agriplan/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ReasonDialog } from "@/components/agriplan/ReasonDialog";
import { FilterChips } from "@/components/agriplan/FilterChips";
import { ComiteTable } from "@/components/agriplan/ComiteTable";
import { TableCell, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatError } from "@/lib/format-error";

export const Route = createFileRoute("/_authenticated/app/admin/users")({
  ssr: false,
  component: () => <AdminShell><UsersView /></AdminShell>,
});

type PlatformRoleFilter = "all" | "user" | "comite" | "admin";
type StatusFilter = "all" | "actif" | "inactif";
type NewRole = "user" | "comite" | "admin";

function UsersView() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [pfFilter, setPfFilter] = useState<PlatformRoleFilter>("all");
  const [stFilter, setStFilter] = useState<StatusFilter>("all");

  const users = useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, platform_role, actif, created_at, org_members(org_id, role, organizations!inner(name,type))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [dialog, setDialog] = useState<
    null | { userId: string; kind: "set_role"; role: NewRole; label: string } | { userId: string; kind: "toggle"; actif: boolean }
  >(null);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = users.data ?? [];
    if (s) {
      list = list.filter((u: any) =>
        (u.full_name || "").toLowerCase().includes(s) || (u.email || "").toLowerCase().includes(s),
      );
    }
    if (pfFilter !== "all") list = list.filter((u: any) => (u.platform_role ?? "user") === pfFilter);
    if (stFilter !== "all") list = list.filter((u: any) => (stFilter === "actif" ? u.actif !== false : u.actif === false));
    return list;
  }, [users.data, q, pfFilter, stFilter]);

  async function handle(motif: string) {
    if (!dialog) return;
    try {
      if (dialog.kind === "toggle") {
        const { error } = await supabase.rpc("admin_toggle_user_active", {
          p_user_id: dialog.userId, p_actif: dialog.actif, p_motif: motif,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("admin_set_user_platform_role", {
          p_user_id: dialog.userId, p_role: dialog.role, p_motif: motif,
        });
        if (error) throw error;
      }
      toast.success("Action journalisée.");
      qc.invalidateQueries({ queryKey: ["admin_users"] });
    } catch (e) {
      toast.error(formatError(e));
    }
  }

  const counts = useMemo(() => {
    const list = users.data ?? [];
    return {
      total: list.length,
      user: list.filter((u: any) => (u.platform_role ?? "user") === "user").length,
      comite: list.filter((u: any) => u.platform_role === "comite").length,
      admin: list.filter((u: any) => u.platform_role === "admin").length,
      actif: list.filter((u: any) => u.actif !== false).length,
      inactif: list.filter((u: any) => u.actif === false).length,
    };
  }, [users.data]);

  return (
    <>
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Utilisateurs ({rows.length})</CardTitle>
            <Input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          </div>
          <div className="flex flex-wrap gap-3">
            <FilterChips<PlatformRoleFilter>
              value={pfFilter}
              onChange={setPfFilter}
              options={[
                { value: "all", label: "Tous", count: counts.total },
                { value: "user", label: "User", count: counts.user },
                { value: "comite", label: "Comité", count: counts.comite },
                { value: "admin", label: "Admin", count: counts.admin },
              ]}
            />
            <FilterChips<StatusFilter>
              value={stFilter}
              onChange={setStFilter}
              options={[
                { value: "all", label: "Statut" },
                { value: "actif", label: "Actif", count: counts.actif },
                { value: "inactif", label: "Désactivé", count: counts.inactif },
              ]}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <ComiteTable
            minWidth={1000}
            columns={[
              { key: "user", header: "Utilisateur" },
              { key: "pf", header: "Rôle plateforme" },
              { key: "orgs", header: "Orgs", align: "end" },
              { key: "st", header: "Statut", align: "end" },
              { key: "act", header: "Actions", align: "end" },
            ]}
          >
            {rows.map((u: any) => {
              const pf = (u.platform_role ?? "user") as NewRole;
              const orgs = (u.org_members ?? []) as Array<{ org_id: string; role: string; organizations: { name: string; type: string } }>;
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link to="/app/admin/users/$id" params={{ id: u.id }} className="font-medium hover:underline">
                      {u.full_name || "—"}
                    </Link>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={pf === "admin" ? "ochre" : pf === "comite" ? "sky" : "secondary"} className="mono-eyebrow">
                      {pf}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {orgs.length === 0 ? (
                      <span className="text-muted-foreground">0</span>
                    ) : (
                      <Popover>
                        <PopoverTrigger className="underline decoration-dotted underline-offset-2">
                          {orgs.length}
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-72 text-xs space-y-1">
                          {orgs.map((o) => (
                            <div key={o.org_id} className="flex items-center justify-between gap-2">
                              <span className="truncate">{o.organizations.name}</span>
                              <Badge variant="secondary" className="mono-eyebrow">{o.role}</Badge>
                            </div>
                          ))}
                        </PopoverContent>
                      </Popover>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <Badge variant={u.actif === false ? "destructive" : "secondary"}>
                      {u.actif === false ? "désactivé" : "actif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end space-x-1">
                    <Link to="/app/admin/users/$id" params={{ id: u.id }}>
                      <Button size="sm" variant="ghost">Détail</Button>
                    </Link>
                    {pf !== "comite" && (
                      <Button size="sm" variant="outline" onClick={() => setDialog({ userId: u.id, kind: "set_role", role: "comite", label: "→ comité" })}>
                        → comité
                      </Button>
                    )}
                    {pf !== "admin" && (
                      <Button size="sm" variant="outline" onClick={() => setDialog({ userId: u.id, kind: "set_role", role: "admin", label: "→ admin plateforme" })}>
                        → admin
                      </Button>
                    )}
                    {pf !== "user" && (
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ userId: u.id, kind: "set_role", role: "user", label: "← user" })}>
                        ← user
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setDialog({ userId: u.id, kind: "toggle", actif: !(u.actif !== false) })}>
                      {u.actif === false ? "Activer" : "Désactiver"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                  Aucun utilisateur ne correspond aux filtres.
                </TableCell>
              </TableRow>
            )}
          </ComiteTable>
          <div className="p-3 text-xs text-muted-foreground border-t">
            Les utilisateurs ne sont jamais supprimés. Toute action est journalisée.
          </div>
        </CardContent>
      </Card>

      <ReasonDialog
        open={!!dialog}
        onOpenChange={(v) => !v && setDialog(null)}
        title={
          dialog?.kind === "toggle"
            ? dialog.actif ? "Réactiver l'utilisateur" : "Désactiver l'utilisateur"
            : `Changer le rôle plateforme — ${dialog?.label ?? ""}`
        }
        description="Motif obligatoire (journal d'audit)."
        minLen={10}
        onConfirm={handle}
        destructive={dialog?.kind === "toggle" && !dialog?.actif}
      />
    </>
  );
}