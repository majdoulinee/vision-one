import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/agriplan/AdminShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ReasonDialog } from "@/components/agriplan/ReasonDialog";
import { toast } from "sonner";
import { formatError } from "@/lib/format-error";

export const Route = createFileRoute("/_authenticated/app/admin/consultants")({
  ssr: false,
  component: () => <AdminShell><ConsultantsView /></AdminShell>,
});

function ConsultantsView() {
  const qc = useQueryClient();
  const links = useQuery({
    queryKey: ["admin_consultant_links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultant_links")
        .select("*, consultant_org:organizations!consultant_links_consultant_org_id_fkey(name), client_org:organizations!consultant_links_client_org_id_fkey(name)")
        .order("accorde_le", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const orgs = useQuery({
    queryKey: ["admin_orgs_for_consultants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("id, name, type").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [revokeId, setRevokeId] = useState<string | null>(null);

  async function doRevoke(motif: string) {
    if (!revokeId) return;
    try {
      const { error } = await supabase.rpc("admin_revoke_link", { p_link_id: revokeId, p_motif: motif });
      if (error) throw error;
      toast.success("Lien révoqué.");
      qc.invalidateQueries({ queryKey: ["admin_consultant_links"] });
    } catch (e) { toast.error(formatError(e)); }
  }

  const consultantOrgs = (orgs.data ?? []).filter((o: any) => o.type === "consultant");

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Attachements consultant ↔ client</CardTitle>
            <CardDescription>Toute génération d'un consultant pour un client est marquée dans le ledger. Rien n'est supprimé — seul le statut change.</CardDescription>
          </div>
          <AttachDialog consultants={consultantOrgs} clients={orgs.data ?? []} onDone={() => qc.invalidateQueries()} />
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-muted/50 text-xs uppercase font-mono tracking-wider">
              <tr>
                <th className="p-2 text-start">Consultant</th>
                <th className="p-2 text-start">Client</th>
                <th className="p-2 text-start">Rôle</th>
                <th className="p-2 text-start">Crédits</th>
                <th className="p-2 text-start">Statut</th>
                <th className="p-2 text-start">Date</th>
                <th className="p-2 text-end">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(links.data ?? []).map((l: any) => (
                <tr key={l.id} className={l.statut === "revoque" ? "opacity-60" : ""}>
                  <td className="p-2 font-medium">{l.consultant_org?.name}</td>
                  <td className="p-2">{l.client_org?.name}</td>
                  <td className="p-2 text-xs font-mono uppercase">{l.role}</td>
                  <td className="p-2 text-xs">source: {l.credits_source}</td>
                  <td className="p-2 text-xs"><span className={`rounded px-1.5 py-0.5 ${l.statut === "actif" ? "bg-primary/10 text-primary" : "bg-muted"}`}>{l.statut}</span></td>
                  <td className="p-2 text-xs text-muted-foreground">{new Date(l.accorde_le).toLocaleDateString()}</td>
                  <td className="p-2 text-end">
                    {l.statut === "actif" && <Button size="sm" variant="destructive" onClick={() => setRevokeId(l.id)}>Révoquer</Button>}
                  </td>
                </tr>
              ))}
              {(links.data ?? []).length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">Aucun attachement pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <ReasonDialog open={!!revokeId} onOpenChange={(v) => !v && setRevokeId(null)}
        title="Révoquer l'accès du consultant" minLen={5} destructive confirmLabel="Révoquer"
        onConfirm={doRevoke} />
    </>
  );
}

function AttachDialog({ consultants, clients, onDone }: { consultants: any[]; clients: any[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [consultantId, setConsultantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [role, setRole] = useState<"operateur" | "lecteur">("operateur");
  const [source, setSource] = useState<"client" | "consultant">("client");
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!consultantId || !clientId) return toast.error("Sélectionner consultant et client.");
    if (consultantId === clientId) return toast.error("Consultant et client doivent être distincts.");
    if (motif.trim().length < 10) return toast.error("Motif ≥ 10 car.");
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_link_consultant", {
        p_consultant_org: consultantId, p_client_org: clientId,
        p_role: role, p_source: source, p_motif: motif,
      });
      if (error) throw error;
      toast.success("Consultant attaché.");
      setOpen(false); setMotif("");
      onDone();
    } catch (e) { toast.error(formatError(e)); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>+ Attacher</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attacher un consultant à un client</DialogTitle>
          <DialogDescription>L'attachement est visible côté client (bannière) et immédiatement révocable.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Consultant (org type consultant)</Label>
            <select value={consultantId} onChange={(e) => setConsultantId(e.target.value)} className="w-full rounded border bg-background px-2 py-1.5 text-sm">
              <option value="">—</option>
              {consultants.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Organisation cliente</Label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full rounded border bg-background px-2 py-1.5 text-sm">
              <option value="">—</option>
              {clients.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.type}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rôle</Label>
              <select value={role} onChange={(e) => setRole(e.target.value as any)} className="w-full rounded border bg-background px-2 py-1.5 text-sm">
                <option value="operateur">Opérateur (peut générer)</option>
                <option value="lecteur">Lecteur seul</option>
              </select>
            </div>
            <div>
              <Label>Source des crédits</Label>
              <select value={source} onChange={(e) => setSource(e.target.value as any)} className="w-full rounded border bg-background px-2 py-1.5 text-sm">
                <option value="client">Débiter le client</option>
                <option value="consultant">Débiter le consultant</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Motif (min. 10 car.)</Label>
            <Input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Contrat de mission signé le…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={submit} disabled={busy}>Attacher</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
