import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/agriplan/BackButton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReasonDialog } from "@/components/agriplan/ReasonDialog";
import { toast } from "sonner";
import { formatError } from "@/lib/format-error";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin/users/$id")({
  ssr: false,
  component: UserDetail,
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
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const actorIds = useMemo(
    () => Array.from(new Set((audit.data ?? []).map((a: any) => a.user_id).filter(Boolean))),
    [audit.data],
  );
  const actorProfiles = useQuery({
    queryKey: ["admin_user_audit_actors", actorIds.join(",")],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds);
      if (error) throw error;
      return data ?? [];
    },
  });
  const actorMap = useMemo(() => {
    const m = new Map<string, { name: string; email: string | null }>();
    for (const p of (actorProfiles.data ?? []) as any[]) {
      m.set(p.id, { name: p.full_name || p.email || p.id.slice(0, 8), email: p.email });
    }
    return m;
  }, [actorProfiles.data]);

  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fAction, setFAction] = useState<string>("all");
  const [fActor, setFActor] = useState<string>("all");

  const uniqueActions = useMemo(
    () => Array.from(new Set((audit.data ?? []).map((a: any) => a.action).filter(Boolean))).sort(),
    [audit.data],
  );

  const filteredAudit = useMemo(() => {
    const rows = (audit.data ?? []) as any[];
    const fromTs = fFrom ? new Date(fFrom).getTime() : null;
    const toTs = fTo ? new Date(fTo).getTime() + 24 * 3600 * 1000 - 1 : null;
    return rows.filter((a) => {
      const t = new Date(a.at).getTime();
      if (fromTs !== null && t < fromTs) return false;
      if (toTs !== null && t > toTs) return false;
      if (fAction !== "all" && a.action !== fAction) return false;
      if (fActor !== "all" && a.user_id !== fActor) return false;
      return true;
    });
  }, [audit.data, fFrom, fTo, fAction, fActor]);

  function exportCsv() {
    const rows = filteredAudit;
    const header = ["date", "action", "entity_type", "entity_id", "acteur", "acteur_email", "org_id", "motif"];
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(",")];
    for (const a of rows) {
      const actor = a.user_id ? actorMap.get(a.user_id) : null;
      lines.push([
        new Date(a.at).toISOString(),
        a.action ?? "",
        a.entity_type ?? "",
        a.entity_id ?? "",
        actor?.name ?? a.user_id ?? "",
        actor?.email ?? "",
        a.org_id ?? "",
        a.meta?.motif ?? "",
      ].map(esc).join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-${id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

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
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Historique d'audit</CardTitle>
              <CardDescription>
                {filteredAudit.length} / {(audit.data ?? []).length} événement(s) — 500 derniers max.
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={filteredAudit.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Exporter CSV
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3">
            <div className="space-y-1">
              <Label className="text-xs">Du</Label>
              <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Au</Label>
              <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Action</Label>
              <Select value={fAction} onValueChange={setFAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {uniqueActions.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Acteur</Label>
              <Select value={fActor} onValueChange={setFActor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {actorIds.map((uid) => (
                    <SelectItem key={uid} value={uid}>
                      {actorMap.get(uid)?.name ?? uid.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(fFrom || fTo || fAction !== "all" || fActor !== "all") && (
            <div className="pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setFFrom(""); setFTo(""); setFAction("all"); setFActor("all"); }}
              >
                Réinitialiser
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {filteredAudit.map((a: any) => (
            <div key={a.id} className="flex items-start justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium mono-eyebrow">{a.action}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {a.entity_type} · {a.entity_id?.slice(0, 8)}{a.meta?.motif ? ` — ${a.meta.motif}` : ""}
                  {a.user_id && actorMap.get(a.user_id) ? ` · par ${actorMap.get(a.user_id)!.name}` : ""}
                </div>
              </div>
              <div className="text-xs text-muted-foreground shrink-0">{new Date(a.at).toLocaleString()}</div>
            </div>
          ))}
          {filteredAudit.length === 0 && (
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