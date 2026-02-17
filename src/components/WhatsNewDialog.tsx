import { useState, useEffect, useCallback, forwardRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";

const WHATS_NEW_KEY = "gymberget_last_seen_changelog";

const changelog = [
  {
    version: "1.3.0",
    date: "2026-02-13",
    items: [
      "📢 Inkorg – admin kan publicera meddelanden till alla användare",
      "🔔 Push-notis vid nya meddelanden i inkorgen",
      "💡 Förslagslåda – skicka in idéer och feedback",
      "👑 Rollsystem – admin och medlem visas under Verktyg",
      "🔒 Förbättrad säkerhet – anonym åtkomst blockerad på känsliga tabeller",
      "👤 Profilbild visas nu i vänlistan",
      "📂 Profil och säkerhetsfrågor öppnas som dropdown i inställningar",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-02-13",
    items: [
      "🗑️ Du kan nu ta bort enskilda övningar från pass",
      "🌙 Mörkt läge – byt tema under Verktyg → Inställningar",
      "📋 Kopiera tidigare pass med automatisk progressiv ökning",
      "✨ Förenklad skapning av enskilda pass – lägg till övningar efteråt",
    ],
  },
];

// Unique fingerprint of all changelog content
const CURRENT_CHANGELOG_ID = changelog.map((e) => e.version).join(",");

const WhatsNewDialog = forwardRef<HTMLDivElement>((_, ref) => {
  const [open, setOpen] = useState(false);
  const [unseenEntries, setUnseenEntries] = useState(changelog);

  const checkAndShow = useCallback(() => {
    const lastSeen = localStorage.getItem(WHATS_NEW_KEY);
    if (lastSeen === CURRENT_CHANGELOG_ID) return; // nothing new

    // Determine which entries are new
    const lastSeenVersions = (lastSeen || "").split(",").filter(Boolean);
    const unseen = changelog.filter((e) => !lastSeenVersions.includes(e.version));

    if (unseen.length === 0) {
      // Edge case: versions match but ID differs — mark as seen
      localStorage.setItem(WHATS_NEW_KEY, CURRENT_CHANGELOG_ID);
      return;
    }

    setUnseenEntries(unseen);
    setOpen(true);
  }, []);

  useEffect(() => {
    // Show on initial mount (app open / login)
    const timer = setTimeout(checkAndShow, 800);

    // Also show when app comes back to foreground
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkAndShow();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [checkAndShow]);

  const handleClose = () => {
    localStorage.setItem(WHATS_NEW_KEY, CURRENT_CHANGELOG_ID);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Nyheter
          </DialogTitle>
          <DialogDescription>Se vad som är nytt i appen</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {unseenEntries.map((entry) => (
            <div key={entry.version}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm font-bold">v{entry.version}</span>
                <span className="text-xs text-muted-foreground">{entry.date}</span>
              </div>
              <ul className="space-y-1.5">
                {entry.items.map((item, i) => (
                  <li key={i} className="text-sm text-foreground">{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <button
          onClick={handleClose}
          className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-md text-sm mt-2"
        >
          Förstått!
        </button>
      </DialogContent>
    </Dialog>
  );
});
WhatsNewDialog.displayName = "WhatsNewDialog";

export default WhatsNewDialog;
