import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentOrg, ORG_ROLES, type OrgRole } from "@/hooks/use-current-org";
import { useSession } from "@/hooks/use-session";
import { usePlatformRole } from "@/hooks/use-platform-role";
import { useConsultantLinksForClient } from "@/hooks/use-consultant-links";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { sendInvitationEmail } from "@/lib/invitations.functions";
import { formatError } from "@/lib/format-error";
import { fmtCountry } from "@/lib/format";
import { Mail, Users, LogOut, Info } from "lucide-react";
import { ReasonDialog } from "@/components/agriplan/ReasonDialog";
import { InviteMemberForm } from "@/components/agriplan/InviteMemberForm";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
  head: () => ({
    meta: [
      { title: "Paramètres — Vision One" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Member = {
  user_id: string;
  role: OrgRole;
  profile: { full_name: string | null; email: string | null; platform_role: string | null } | null;
};

type Invitation = {
  id: string;
  email: string;
  role: OrgRole;
  accepted_at: string | null;
  expires_at: string;
};

function Settings() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { current } = useCurrentOrg();
  const { data: myPlatformRole } = usePlatformRole();
  const qc = useQueryClient();
  const sendEmail = useServerFn(sendInvitationEmail);
  const orgId = current?.org_id ?? null;
  const myRole = current?.role;
  const isOwner = myRole === "owner";
  const canManage = isOwner || myRole === "admin";

  const members = useQuery({
    queryKey: ["members", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("org_members")
        .select("user_id, role, profile:profiles!inner(full_name,email,platform_role)")
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

  const consultantLinksQ = useConsultantLinksForClient();
  const activeLinks = (consultantLinksQ.data ?? []).filter((l: any) => l.statut === "actif");

  // Only owners can create owners
  const invitableRoles = useMemo<OrgRole[]>(
    () => (isOwner ? ["owner", "admin", "editor", "member", "viewer"] : ["admin", "editor", "member", "viewer"]),
    [isOwner],
  );

  const [reasonDialog, setReasonDialog] = useState<
    | { kind: "change_role"; userId: string; newRole: OrgRole; label: string }
    | { kind: "remove_member"; userId: string; label: string }
    | { kind: "revoke_consultant"; linkId: string; label: string }
    | null
  >(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const ownerCount = (members.data ?? []).filter((m) => m.role === "owner").length;

  async function resend(id: string) {
    try {
      const result = await sendEmail({ data: { invitationId: id } });
      if (result?.sent) toast.success(t("settings.resent"));
      else toast.warning(t("settings.emailFailed"));
    } catch (err) {
      toast.error(formatError(err));
    }
  }

  async function extend(id: string) {
    try {
      const { error } = await supabase.rpc("org_extend_invitation", { p_inv_id: id });
      if (error) throw error;
      toast.success(t("settings.extended"));
      qc.invalidateQueries({ queryKey: ["invitations", orgId] });
    } catch (e) {
      toast.error(formatError(e));
    }
  }

  async function revoke(id: string) {
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["invitations", orgId] });
  }

  async function handleReason(motif: string) {
    if (!reasonDialog || !orgId) return;
    try {
      if (reasonDialog.kind === "change_role") {
        const { error } = await supabase.rpc("org_set_member_role", {
          p_org: orgId, p_user: reasonDialog.userId, p_role: reasonDialog.newRole, p_motif: motif,
        });
        if (error) throw error;
        toast.success(t("settings.roleUpdated"));
      } else if (reasonDialog.kind === "remove_member") {
        const { error } = await supabase.rpc("org_remove_member", {
          p_org: orgId, p_user: reasonDialog.userId, p_motif: motif,
        });
        if (error) throw error;
        toast.success(t("settings.memberRemoved"));
      } else if (reasonDialog.kind === "revoke_consultant") {
        const { error } = await supabase.rpc("client_request_consultant_revocation", {
          p_link_id: reasonDialog.linkId, p_motif: motif,
        });
        if (error) throw error;
        toast.success(t("consultants.revocationSent"));
      }
      qc.invalidateQueries({ queryKey: ["members", orgId] });
      qc.invalidateQueries({ queryKey: ["consultant_links_client", orgId] });
    } catch (e) {
      toast.error(formatError(e));
    }
  }

  async function doLeave() {
    if (!orgId) return;
    try {
      const { error } = await supabase.rpc("org_leave", { p_org: orgId });
      if (error) throw error;
      toast.success(t("settings.leftOrg"));
      qc.invalidateQueries({ queryKey: ["my-orgs"] });
      qc.invalidateQueries({ queryKey: ["members", orgId] });
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setConfirmLeave(false);
    }
  }

  if (!current) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h1>

      {(myPlatformRole === "admin" || myPlatformRole === "comite") && (
        <div className="rounded-md border border-accent/50 bg-accent/10 px-4 py-2 text-sm flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            {t("settings.actingAs", { role: t(`role.${myRole}`) })}{" "}
            {t("settings.platformPrivileges", { role: myPlatformRole })}{" "}
            {myPlatformRole === "admin" ? (
              <a className="underline" href="/app/admin/organizations">/app/admin</a>
            ) : (
              <a className="underline" href="/app/comite/propositions">/app/comite</a>
            )}.
          </div>
        </div>
      )}

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
            <div className="font-medium">{t(`orgType.${current.org.type}`)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t("auth.country")}</div>
            <div className="font-medium">{fmtCountry(current.org.country)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>{t("settings.members")}</CardTitle>
            <CardDescription>
              {t("settings.membersCount", { count: members.data?.length ?? 0, owners: ownerCount })}
            </CardDescription>
          </div>
          {myRole && myRole !== "owner" && (
            <Button variant="outline" size="sm" onClick={() => setConfirmLeave(true)}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> {t("settings.leaveOrg")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("auth.fullName")}</TableHead>
                <TableHead>{t("settings.email")}</TableHead>
                <TableHead>{t("settings.role")}</TableHead>
                {canManage && <TableHead className="text-end">{t("common.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.data?.map((m) => {
                const isSelf = m.user_id === user?.id;
                const isTargetOwner = m.role === "owner";
                const canChangeTarget =
                  canManage && !isSelf && (isOwner || !isTargetOwner);
                const pf = m.profile?.platform_role;
                return (
                  <TableRow key={m.user_id}>
                    <TableCell>
                      <div className="font-medium">{m.profile?.full_name ?? "—"}</div>
                      {isSelf && <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("settings.you")}</div>}
                    </TableCell>
                    <TableCell>{m.profile?.email ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="secondary">{t(`role.${m.role}`)}</Badge>
                        {pf === "admin" && <Badge variant="ochre" className="mono-eyebrow">{t("settings.platformAdmin")}</Badge>}
                        {pf === "comite" && <Badge variant="sky" className="mono-eyebrow">{t("settings.committee")}</Badge>}
                      </div>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-end space-x-1">
                        <Select
                          value={m.role}
                          onValueChange={(v) => {
                            if (v === m.role) return;
                            const nr = v as OrgRole;
                            setReasonDialog({
                              kind: "change_role",
                              userId: m.user_id,
                              newRole: nr,
                              label: `${m.profile?.email ?? m.user_id} → ${t(`role.${nr}`)}`,
                            });
                          }}
                          disabled={!canChangeTarget}
                        >
                          <SelectTrigger className="inline-flex h-8 w-[130px]" aria-label={t("settings.role")}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ORG_ROLES.filter((r) => isOwner || r !== "owner").map((r) => (
                              <SelectItem key={r} value={r}>{t(`role.${r}`)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!canChangeTarget}
                          onClick={() =>
                            setReasonDialog({
                              kind: "remove_member",
                              userId: m.user_id,
                              label: m.profile?.email ?? m.user_id,
                            })
                          }
                        >
                          {t("settings.remove")}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.invitations")}</CardTitle>
            <CardDescription>
              {t("settings.invitationsDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InviteMemberForm
              orgId={orgId!}
              allowedRoles={invitableRoles}
              defaultRole="member"
              onSent={() => qc.invalidateQueries({ queryKey: ["invitations", orgId] })}
            />

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("settings.email")}</TableHead>
                  <TableHead>{t("settings.role")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(invitations.data ?? []).map((i) => {
                  const expired = new Date(i.expires_at).getTime() < Date.now();
                  return (
                    <TableRow key={i.id}>
                      <TableCell>{i.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{t(`role.${i.role}`)}</Badge>
                      </TableCell>
                      <TableCell>
                        {expired ? (
                          <Badge variant="destructive">{t("settings.expired")}</Badge>
                        ) : (
                          <Badge variant="secondary">{t("settings.pending")}</Badge>
                        )}
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          {new Date(i.expires_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {expired && (
                          <Button variant="outline" size="sm" onClick={() => extend(i.id)}>
                            {t("settings.extend")}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => resend(i.id)}>
                          <Mail className="mr-1 h-3.5 w-3.5" />
                          {t("settings.resend")}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => revoke(i.id)}>
                          {t("settings.revoke")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(invitations.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="p-4 text-center text-sm text-muted-foreground">
                      {t("settings.noInvitations")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> {t("settings.linkedConsultants")}
          </CardTitle>
          <CardDescription>
            {t("settings.linkedConsultantsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {activeLinks.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t("settings.noLinkedConsultants")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("settings.colFirm")}</TableHead>
                  <TableHead>{t("settings.role")}</TableHead>
                  <TableHead>{t("consultants.colCredits")}</TableHead>
                  <TableHead>{t("consultants.colSince")}</TableHead>
                  {canManage && <TableHead className="text-end">{t("common.actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeLinks.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.consultant_org?.name ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{l.role}</Badge></TableCell>
                    <TableCell className="text-xs">{t("consultants.sourceLabel", { source: l.credits_source })}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(l.accorde_le).toLocaleDateString()}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setReasonDialog({
                              kind: "revoke_consultant",
                              linkId: l.id,
                              label: l.consultant_org?.name ?? "",
                            })
                          }
                        >
                          {t("consultants.requestRevocation")}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ReasonDialog
        open={!!reasonDialog}
        onOpenChange={(v) => !v && setReasonDialog(null)}
        title={
          reasonDialog?.kind === "change_role"
            ? t("settings.changeRoleTitle", { label: reasonDialog.label })
            : reasonDialog?.kind === "remove_member"
              ? t("settings.removeMemberTitle", { label: reasonDialog.label })
              : reasonDialog?.kind === "revoke_consultant"
                ? t("settings.revokeConsultantTitle", { label: reasonDialog.label })
                : ""
        }
        description={t("settings.reasonRequired")}
        minLen={5}
        destructive={reasonDialog?.kind !== "change_role"}
        confirmLabel={
          reasonDialog?.kind === "change_role"
            ? t("common.apply")
            : reasonDialog?.kind === "remove_member"
              ? t("settings.remove")
              : t("settings.sendRequest")
        }
        onConfirm={handleReason}
      />

      <ReasonDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title={t("settings.leaveOrg")}
        description={t("settings.leaveOrgDesc")}
        minLen={5}
        destructive
        confirmLabel={t("settings.leave")}
        onConfirm={async () => {
          await doLeave();
        }}
      />
    </div>
  );
}