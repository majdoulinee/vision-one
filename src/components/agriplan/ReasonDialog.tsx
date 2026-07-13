import { useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ReasonDialog({
  open, onOpenChange, title, description, minLen = 10, confirmLabel = "Confirmer",
  destructive = false, onConfirm,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  title: string; description?: string;
  minLen?: number; confirmLabel?: string; destructive?: boolean;
  onConfirm: (motif: string) => Promise<void> | void;
}) {
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try { await onConfirm(motif); setMotif(""); onOpenChange(false); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { onOpenChange(v); if (!v) setMotif(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Textarea rows={3} value={motif} onChange={(e) => setMotif(e.target.value)}
          placeholder={`Motif obligatoire (min. ${minLen} caractères)`} />
        <div className="text-xs text-muted-foreground">{motif.trim().length}/{minLen}</div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant={destructive ? "destructive" : "default"}
            disabled={busy || motif.trim().length < minLen} onClick={submit}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}