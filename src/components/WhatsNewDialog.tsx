import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";

const APP_VERSION = "1.2.0";
const WHATS_NEW_KEY = "gymberget_last_seen_version";

const changelog = [
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

const WhatsNewDialog = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const lastSeen = localStorage.getItem(WHATS_NEW_KEY);
    if (lastSeen !== APP_VERSION) {
      // Small delay so the app loads first
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(WHATS_NEW_KEY, APP_VERSION);
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
          {changelog.map((entry) => (
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
};

export default WhatsNewDialog;
