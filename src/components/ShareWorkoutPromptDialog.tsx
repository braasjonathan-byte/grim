import { useEffect, useMemo, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share2, X, Loader2, AlertCircle } from "lucide-react";

interface ShareWorkoutPromptDialogProps {
  open: boolean;
  initialCaption?: string | null;
  loading?: boolean;
  nickname?: string | null;
  avatarUrl?: string | null;
  defaultVisibility?: "friends" | "public";
  onConfirm: (caption: string, newTitle: string | undefined, visibility: "friends" | "public") => void | Promise<void>;
  onSkip: () => void;
}

// Matches the fallback header produced by buildWorkoutSummaryCaption when no name exists:
//   "🏋️ Pass – Vecka 3 · 5 jun"  or  "🏋️ Pass · 5 jun"
const MISSING_TITLE_RE = /^(🏋️\s+)Pass(\s+[–·])/;

const ShareWorkoutPromptDialog = ({ open, initialCaption, loading, nickname, avatarUrl, defaultVisibility = "friends", onConfirm, onSkip }: ShareWorkoutPromptDialogProps) => {
  const [caption, setCaption] = useState(initialCaption || "");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [visibility, setVisibility] = useState<"friends" | "public">(defaultVisibility);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setCaption(initialCaption || "");
      setTitle("");
      setSubmitting(false);
      setVisibility(defaultVisibility);
    }
  }, [open, initialCaption, defaultVisibility]);

  // Keep caption in sync if it loads asynchronously
  useEffect(() => {
    if (open && !caption && initialCaption) setCaption(initialCaption);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCaption]);

  // Detect if the auto-generated caption uses the fallback "Pass" name (= workout has no title yet)
  const needsTitle = useMemo(() => {
    const firstLine = (caption || "").split("\n")[0] || "";
    return MISSING_TITLE_RE.test(firstLine);
  }, [caption]);

  const finalCaption = useMemo(() => {
    if (!needsTitle || !title.trim()) return caption;
    const lines = caption.split("\n");
    lines[0] = lines[0].replace(MISSING_TITLE_RE, `$1${title.trim()}$2`);
    return lines.join("\n");
  }, [caption, title, needsTitle]);

  const handleConfirm = async () => {
    if (needsTitle && !title.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(finalCaption.trim(), needsTitle ? title.trim() : undefined, visibility);
    } finally {
      setSubmitting(false);
    }
  };

  const initial = (nickname || "?").trim().charAt(0).toUpperCase();
  const titleMissing = needsTitle && !title.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !submitting) onSkip(); }}>
      <DialogContent className="max-w-sm max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" /> Dela passet?
          </DialogTitle>
          <DialogDescription>
            Inget publiceras om du inte trycker Dela.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Bygger sammanfattning…
          </div>
        ) : (
          <>
            {needsTitle && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                  Passnamn krävs
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-secondary text-foreground text-sm p-3 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary"
                  placeholder="T.ex. Ben, Push, Löpning…"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  Det här passet saknar namn. Ange ett namn för att kunna publicera det.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Inlägg</label>
                <div className="flex items-center gap-2">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={nickname || ""} className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                      {initial}
                    </div>
                  )}
                  <span className="text-[11px] text-muted-foreground">{nickname || "Du"}</span>
                </div>
              </div>
              <textarea
                ref={textareaRef}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={8}
                className="w-full bg-card text-foreground text-sm p-3 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary resize-y min-h-[180px]"
                placeholder="Skriv en bildtext…"
              />
            </div>
          </>
        )}

        {!loading && (
          <div className="flex gap-2" role="radiogroup" aria-label="Synlighet">
            {([["friends", "👫 Bara vänner"], ["public", "🌍 Alla"]] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={visibility === v}
                onClick={() => setVisibility(v)}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm ${visibility === v ? "border-primary bg-primary/10 font-semibold" : "border-border text-muted-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 mt-2">
          <Button onClick={handleConfirm} className="w-full" disabled={submitting || loading || !finalCaption.trim() || titleMissing}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            {titleMissing ? "Ange passnamn för att publicera" : "Dela"}
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
