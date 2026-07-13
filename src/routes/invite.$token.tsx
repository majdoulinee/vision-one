import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  component: InvitePage,
});

type Inv = {
  id: string;
  org_id: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  expires_at: string;
  accepted_at: string | null;
  org: { name: string; org_type: string } | null;
};

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "need-auth"; inv: Inv }
    | { kind: "ready"; inv: Inv }
    | { kind: "invalid"; reason: string }
  >({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: invData, error } = await supabase
        .from("invitations")
        .select("id,org_id,email,role,expires_at,accepted_at,org:organizations!inner(name,org_type)")
        .eq("token", token)
        .maybeSingle();
      if (error || !invData)
        return setState({ kind: "invalid", reason: "Invitation introuvable" });
      const inv = invData as unknown as Inv;
      if (inv.accepted_at)
        return setState({ kind: "invalid", reason: "Invitation déjà acceptée" });
      if (new Date(inv.expires_at) < new Date())
        return setState({ kind: "invalid", reason: "Invitation expirée" });
      const { data } = await supabase.auth.getUser();
      if (!data.user) return setState({ kind: "need-auth", inv });
      if (data.user.email?.toLowerCase() !== inv.email.toLowerCase())
        return setState({ kind: "invalid", reason: "Connectez-vous avec " + inv.email });
      setState({ kind: "ready", inv });
    })();
  }, [token]);

  async function accept() {
    if (state.kind !== "ready") return;
    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error: mErr } = await supabase
        .from("org_members")
        .insert({ org_id: state.inv.org_id, user_id: user.id, role: state.inv.role });
      if (mErr) throw mErr;
      const { error: uErr } = await supabase
        .from("invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", state.inv.id);
      if (uErr) throw uErr;
      window.localStorage.setItem("visionone.currentOrgId", state.inv.org_id);
      // Legacy key kept in sync for existing sessions.
      window.localStorage.setItem("agriplan.currentOrgId", state.inv.org_id);
      toast.success("Bienvenue dans " + (state.inv.org?.name ?? ""));
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Invitation</CardTitle>
          <CardDescription>Rejoindre une organisation Vision One</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.kind === "loading" && <div>Chargement...</div>}
          {state.kind === "invalid" && <div className="text-destructive">{state.reason}</div>}
          {state.kind === "need-auth" && (
            <>
              <p>
                Vous êtes invité·e à rejoindre <b>{state.inv.org?.name}</b> en tant que{" "}
                <b>{state.inv.role}</b>. Connectez-vous avec <b>{state.inv.email}</b> pour continuer.
              </p>
              <Button
                onClick={() =>
                  navigate({
                    to: "/auth",
                    search: { mode: "signup" },
                  })
                }
                className="w-full"
              >
                Se connecter / S'inscrire
              </Button>
            </>
          )}
          {state.kind === "ready" && (
            <>
              <p>
                Rejoindre <b>{state.inv.org?.name}</b> en tant que <b>{state.inv.role}</b> ?
              </p>
              <Button onClick={accept} disabled={busy} className="w-full">
                Accepter l'invitation
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}