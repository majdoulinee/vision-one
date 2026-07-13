import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/agriplan/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ReasonDialog } from "@/components/agriplan/ReasonDialog";
import { toast } from "sonner";
import { formatError } from "@/lib/format-error";

export const Route = createFileRoute("/_authenticated/app/admin/users")({
  ssr: false,
  component: () => <AdminShell><UsersView /></AdminShell>,
});

function UsersView() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const users = useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, platform_role, actif, created_at, org_members(org_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [dialog, setDialog] = useState<null | { userId: string; kind: "promote_comite" | "demote_comite" | "toggle"; actif?: boolean }>(null);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = users.data ?? [];
    return s ? list.filter((u: any) => (u.full_name || "").toLowerCase().includes(s) || (u.email || "").toLowerCase().includes(s)) : list;
  }, [users.data, q]);

  async function handle(motif: string) {
    if (!dialog) return;
    try {
      if (dialog.kind === "toggle") {
        const { error } = await supabase.rpc("admin_toggle_user_active", { p_user_id: dialog.userId, p_actif: !!dialog.actif, p_motif: motif });
        if (error) throw error;
      } else {
        const role = dialog.kind === "promote_comite" ? "comite" : "user";
        const { error } = await supabase.rpc("admin_set_user_platform_role", { p_user_id: dialog.userId, p_role: role, p_motif: motif });
        if (error) throw error;
      }
      toast.success("Action journalisée.");
      qc.invalidateQueries({ queryKey: ["admin_users"] });
    } catch (e) { toast.error(formatError(e)); }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle>Utilisateurs ({rows.length})</CardTitle>
          <Input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-muted/50 text-xs uppercase font-mono tracking-wider">
              <tr>
                <th className="p-2 text-start">Utilisateur</th>
                <th className="p-2 text-start">Rôle plateforme</th>
                <th className="p-2 text-end">Orgs</th>
                <th className="p-2 text-end">Statut</th>
                <th className="p-2 text-end">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((u: any) => (
                <tr key={u.id}>
                  <td className="p-2">
                    <div className="font-medium">{u.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="p-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider rounded border px-1.5 py-0.5">{u.platform_role ?? "user"}</span>
                  </td>
                  <td className="p-2 text-end tabular-nums">{u.org_members?.length ?? 0}</td>
                  <td className="p-2 text-end">
                    <span className={`text-xs rounded px-2 py-0.5 ${u.actif === false ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"}`}>
                      {u.actif === false ? "désactivé" : "actif"}
                    </span>
                  </td>
                  <td className="p-2 text-end space-x-1">
                    {u.platform_role !== "comite" ? (
                      <Button size="sm" variant="outline" onClick={() => setDialog({ userId: u.id, kind: "promote_comite" })}>→ comité</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setDialog({ userId: u.id, kind: "demote_comite" })}>← user</Button>
                    )}
                    <Button size="sm" variant="ghost"
                      onClick={() => setDialog({ userId: u.id, kind: "toggle", actif: !(u.actif !== false) })}>
                      {u.actif === false ? "Activer" : "Désactiver"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-3 text-xs text-muted-foreground border-t">
            Les utilisateurs ne sont jamais supprimés. Toute action est journalisée.
          </div>
        </CardContent>
      </Card>

      <ReasonDialog
        open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}
        title={dialog?.kind === "toggle" ? (dialog?.actif ? "Réactiver l'utilisateur" : "Désactiver l'utilisateur") : "Changer le rôle plateforme"}
        description="Motif obligatoire (journal d'audit)."
        onConfirm={handle}
        destructive={dialog?.kind === "toggle" && !dialog?.actif}
      />
    </>
  );
}
