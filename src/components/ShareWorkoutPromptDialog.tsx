import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share2, X, Loader2 } from "lucide-react";

interface ShareWorkoutPromptDialogProps {
  open: boolean;
  initialCaption?: string | null;
  loading?: boolean;
  onConfirm: (caption: string) => void | Promise<void>;
  onSkip: () => void;
}

const ShareWorkoutPromptDialog = ({ open, initialCaption, loading, onConfirm, onSkip }: ShareWorkoutPromptDialogProps) => {
  const [caption, setCaption] = useState(initialCaption || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setCaption(initialCaption || "");
      setSubmitting(false);
    }
  }, [open, initialCaption]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(caption.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !submitting) onSkip(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" /> Dela passet?
          </DialogTitle>
          <DialogDescription>
            Snyggt jobbat! Granska och redigera texten innan du delar med dina vänner.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Bygger sammanfattning…
          </div>
        ) : (
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={8}
            className="w-full bg-secondary text-foreground text-sm p-3 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary resize-y min-h-[160px]"
            placeholder="Skriv en bildtext…"
          />
        )}

        <div className="flex flex-col gap-2 mt-2">
          <Button onClick={handleConfirm} className="w-full" disabled={submitting || loading || !caption.trim()}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            Ja, dela med vänner
          </Button>
          <Button variant="outline" onClick={onSkip} className="w-full" disabled={submitting}>
            <X className="w-4 h-4" /> Nej tack
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareWorkoutPromptDialog;
