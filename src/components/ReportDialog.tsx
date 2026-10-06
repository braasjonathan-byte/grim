import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { REPORT_REASONS, ReportReason, submitReport } from "@/lib/socialPrivacy";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reporterId: string;
  reportedUserId: string;
  postId?: string | null;
  title?: string;
}

const ReportDialog = ({ open, onOpenChange, reporterId, reportedUserId, postId, title }: Props) => {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setReason(null); setDetails(""); setBusy(false); }
  }, [open]);

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    const ok = await submitReport({ reporterId, reportedUserId, postId, reason, details: reason === "other" ? details : undefined });
    setBusy(false);
    if (!ok) { toast.error("Rapporten kunde inte skickas. Försök igen."); return; }
    toast.success("Tack, vi tittar på det.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title || "Rapportera inlägg"}</DialogTitle>
          <DialogDescription>Välj en orsak.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setReason(r.value)}
              className={`w-full text-left rounded-xl border px-3 py-2 text-sm ${reason === r.value ? "border-primary bg-primary/10 font-semibold" : "border-border"}`}
            >
              {r.label}
            </button>
          ))}
          {reason === "other" && (
            <div>
              <Textarea value={details} maxLength={500} onChange={(e) => setDetails(e.target.value.slice(0, 500))} placeholder="Beskriv vad som är fel" />
              <p className="text-[11px] text-muted-foreground text-right">{details.length}/500</p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Avbryt</Button>
          <Button onClick={send} disabled={!reason || busy || (reason === "other" && !details.trim())}>Skicka rapport</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;
