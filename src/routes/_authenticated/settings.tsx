import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

type Member = {
  user_id: string;
  role: "owner" | "admin" | "editor" | "viewer";
  profile: { full_name: string | null; email: string | null } | null;
};

type Invitation = {
  id: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  accepted_at: string | null;
  expires_at: string;
};

function Settings() {
  const { t } = useTranslation();
  const { current } = useCurrentOrg();
  const qc = useQueryClient();
  const orgId = current?.org_id ?? null;
  const myRole = current?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  const members = useQuery({
    queryKey: ["members", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("org_members")
        .select("user_id, role, profile:profiles!inner(full_name,email)")
        .eq("org_id", orgId!);
      if (error) throw error;
      return (data ?? []) as unknown as Member[];
    },
  });

  const invitations = useQuery({
    queryKey: ["invitations", orgId],
    enabled: !!orgId && canManage,
    queryFn: async (): Promise<Invitation[]> => {
      const { data, error } = await supabase
        .from("invitations")
        .select("id,email,role,accepted_at,expires_at")
        .eq("org_id", orgId!)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invitation[];
    },
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const token = crypto.randomUUID().replace(/-/g, "");
      const { error } = await supabase.from("invitations").insert({
        org_id: orgId,
        email: email.toLowerCase(),
        role,
        token,
        invited_by: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      });
      if (error) throw error;
      const link = `${window.location.origin}/invite/${token}`;
      await navigator.clipboard.writeText(link).catch(() => undefined);
      toast.success(`Invitation créée. Lien copié : ${link}`);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["invitations", orgId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["invitations", orgId] });
  }

  if (!current) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.organization")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">{t("auth.orgName")}</div>
            <div className="font-medium">{current.org.name}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t("auth.orgType")}</div>
            <div className="font-medium">{t(`orgType.${current.org.org_type}`)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t("auth.country")}</div>
            <div className="font-medium">{current.org.country ?? "—"}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.members")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("auth.fullName")}</TableHead>
                <TableHead>{t("settings.email")}</TableHead>
                <TableHead>{t("settings.role")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.data?.map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell>{m.profile?.full_name ?? "—"}</TableCell>
                  <TableCell>{m.profile?.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{t(`role.${m.role}`)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.invitations")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={sendInvite} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1 space-y-1">
                <Label htmlFor="invEmail">{t("settings.email")}</Label>
                <Input
                  id="invEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>{t("settings.role")}</Label>
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["admin", "editor", "viewer"] as const).map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`role.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={busy}>
                {t("settings.sendInvite")}
              </Button>
            </form>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("settings.email")}</TableHead>
                  <TableHead>{t("settings.role")}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.data?.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{t(`role.${i.role}`)}</Badge>
                    </TableCell>
                    <TableCell>{t("settings.pending")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => revoke(i.id)}>
                        {t("settings.revoke")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}