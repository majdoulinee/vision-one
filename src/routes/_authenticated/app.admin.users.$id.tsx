import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/agriplan/AdminShell";
import { BackButton } from "@/components/agriplan/BackButton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReasonDialog } from "@/components/agriplan/ReasonDialog";
import { toast } from "sonner";
import { formatError } from "@/lib/format-error";

export const Route = createFileRoute("/_authenticated/app/admin/users/$id")({
  ssr: false,
  component: () => <AdminShell><UserDetail /></AdminShell>,
});

type NewRole = "user" | "comite" | "admin";

function UserDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const profile = useQuery({
    queryKey: ["admin_user", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, platform_role, actif, created_at, locale")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const orgs = useQuery({
    queryKey: ["admin_user_orgs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_members")
        .select("org_id, role, organizations!inner(id,name,type,country)")
        .eq("user_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const orgIds = (orgs.data ?? []).map((o: any) => o.org_id);

  const links = useQuery({
    queryKey: ["admin_user_links", id, orgIds.join(",")],
    enabled: orgIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultant_links")
        .select(
          "id, role, statut, credits_source, accorde_le, consultant_org_id, client_org_id, " +
          "consultant_org:organizations!consultant_links_consultant_org_id_fkey(name), " +
          "client_org:organizations!consultant_links_client_org_id_fkey(name)",
        )
        .or(`consultant_org_id.in.(${orgIds.join(",")}),client_org_id.in.(${orgIds.join(",")})`);
      if (error) throw error;
      return data ?? [];
    },
  });

  const audit = useQuery({
    queryKey: ["admin_user_audit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, at, action, entity_type, entity_id, meta, user_id, org_id")
        .or(`user_id.eq.${id},and(entity_type.eq.user,entity_id.eq.${id})`)
        .order("at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [dialog, setDialog] = useState<
    | null
    | { kind: "set_role"; role: NewRole; label: string }
    | { kind: "toggle"; actif: boolean }
  >(null);

  async function handle(motif: string) {
    if (!dialog) return;
    try {
      if (dialog.kind === "toggle") {
        const { error } = await supabase.rpc("admin_toggle_user_active", { p_user_id: id, p_actif: dialog.actif, p_motif: motif });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("admin_set_user_platform_role", { p_user_id: id, p_role: dialog.role, p_motif: motif });
        if (error) throw error;
      }
      toast.success("Action journalisée.");
      qc.invalidateQueries({ queryKey: ["admin_user", id] });
      qc.invalidateQueries({ queryKey: ["admin_user_audit", id] });
    } catch (e) {
      toast.error(formatError(e));
    }
  }

  const p = profile.data;
  const pf = (p?.platform_role ?? "user") as NewRole;

  return (
    <div className="space-y-6">
      <BackButton to="/app/admin/users" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{p?.full_name || "—"}</h1>
          <div className="text-sm text-muted-foreground">{p?.email}</div>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant={pf === "admin" ? "ochre" : pf === "comite" ? "sky" : "secondary"} className="mono-eyebrow">{pf}</Badge>
          <Badge variant={p?.actif === false ? "destructive" : "secondary"}>
            {p?.actif === false ? "désactivé" : "actif"}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
          <CardDescription>Toute action est journalisée dans l'audit.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {pf !== "comite" && (
            <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "set_role", role: "comite", label: "→ comité" })}>
              Promouvoir comité
            </Button>
          )}
          {pf !== "admin" && (
            <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "set_role", role: "admin", label: "→ admin plateforme" })}>
              Promouvoir admin plateforme
            </Button>
          )}
          {pf !== "user" && (
            <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "set_role", role: "user", label: "← user" })}>
              Rétrograder en user
            </Button>
          )}
          <Button size="sm" variant={p?.actif === false ? "default" : "destructive"}
            onClick={() => setDialog({ kind: "toggle", actif: p?.actif === false })}>
            {p?.actif === false ? "Réactiver" : "Désactiver"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organisations ({(orgs.data ?? []).length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {(orgs.data ?? []).map((o: any) => (
            <div key={o.org_id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <div className="font-medium">{o.organizations.name}</div>
                <div className="text-xs text-muted-foreground">{o.organizations.type} · {o.organizations.country ?? "—"}</div>
              </div>
              <Badge variant="secondary" className="mono-eyebrow">{o.role}</Badge>
            </div>
          ))}
          {(orgs.data ?? []).length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">Aucune organisation.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Liens consultant ({(links.data ?? []).length})</CardTitle>
          <CardDescription>Rattachements où l'une des organisations de cet utilisateur est cabinet ou client.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {(links.data ?? []).map((l: any) => (
            <div key={l.id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <div><strong>{l.consultant_org?.name}</strong> → {l.client_org?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {l.role} · source {l.credits_source} · {new Date(l.accorde_le).toLocaleDateString()}
                </div>
              </div>
              <Badge variant={l.statut === "actif" ? "secondary" : "destructive"} className="mono-eyebrow">
                {l.statut}
              </Badge>
            </div>
          ))}
          {(links.data ?? []).length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">Aucun lien.</div>
          )}
          <div className="p-3 text-right">
            <Link to="/app/admin/consultants" className="text-xs text-primary underline">Gérer les rattachements →</Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique d'audit</CardTitle>
          <CardDescription>50 derniers événements liés à ce compte.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {(audit.data ?? []).map((a: any) => (
            <div key={a.id} className="flex items-start justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium mono-eyebrow">{a.action}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {a.entity_type} · {a.entity_id?.slice(0, 8)}{a.meta?.motif ? ` — ${a.meta.motif}` : ""}
                </div>
              </div>
              <div className="text-xs text-muted-foreground shrink-0">{new Date(a.at).toLocaleString()}</div>
            </div>
          ))}
          {(audit.data ?? []).length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">Aucun événement.</div>
          )}
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
    </div>
  );
}