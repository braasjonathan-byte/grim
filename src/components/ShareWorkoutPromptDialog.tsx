import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share2, X, Loader2, Eye } from "lucide-react";

interface ShareWorkoutPromptDialogProps {
  open: boolean;
  initialCaption?: string | null;
  loading?: boolean;
  nickname?: string | null;
  avatarUrl?: string | null;
  onConfirm: (caption: string) => void | Promise<void>;
  onSkip: () => void;
}

const ShareWorkoutPromptDialog = ({ open, initialCaption, loading, nickname, avatarUrl, onConfirm, onSkip }: ShareWorkoutPromptDialogProps) => {
  const [caption, setCaption] = useState(initialCaption || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setCaption(initialCaption || "");
      setSubmitting(false);
    }
  }, [open, initialCaption]);

  // Keep caption in sync if it loads asynchronously
  useEffect(() => {
    if (open && !caption && initialCaption) setCaption(initialCaption);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCaption]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(caption.trim());
    } finally {
      setSubmitting(false);
    }
  };

  const initial = (nickname || "?").trim().charAt(0).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !submitting) onSkip(); }}>
      <DialogContent className="max-w-sm max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" /> Dela passet?
          </DialogTitle>
          <DialogDescription>
            Förhandsgranska och redigera inlägget innan du publicerar för dina vänner.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Bygger sammanfattning…
          </div>
        ) : (
          <>
            {/* Live preview of how the post will appear in the feed */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/40">
                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Förhandsvisning</span>
              </div>
              <div className="flex items-center gap-2 px-3 pt-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={nickname || ""} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                    {initial}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{nickname || "Du"}</div>
                  <div className="text-[11px] text-muted-foreground">Synligt för vänner · nu</div>
                </div>
              </div>
              <div className="px-3 py-2 text-sm whitespace-pre-line break-words min-h-[40px]">
                {caption.trim() ? caption : <span className="text-muted-foreground italic">Skriv en bildtext nedan…</span>}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Redigera inlägg</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={6}
                className="w-full bg-secondary text-foreground text-sm p-3 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary resize-y min-h-[140px]"
                placeholder="Skriv en bildtext…"
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 mt-2">
          <Button onClick={handleConfirm} className="w-full" disabled={submitting || loading || !caption.trim()}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            Ja, publicera för vänner
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
