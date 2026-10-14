import { useState } from "react";
import { X, Megaphone } from "lucide-react";
import { useAppSettings } from "@/lib/appSettings";

/** Global notice set by admins in Inställningar → Adminverktyg. */
export default function AppBanner() {
  const { banner_message } = useAppSettings();
  const [dismissed, setDismissed] = useState<string | null>(() => sessionStorage.getItem("grim_banner_dismissed"));
  const msg = banner_message.trim();
  if (!msg || dismissed === msg) return null;
  return (
    <div className="mx-3 mt-2 flex items-start gap-2 rounded-2xl bg-primary/10 border border-primary/30 px-3 py-2 text-xs text-foreground">
      <Megaphone className="w-4 h-4 text-primary shrink-0 mt-0.5" />
      <p className="flex-1 whitespace-pre-line">{msg}</p>
      <button aria-label="Stäng meddelandet" onClick={() => { sessionStorage.setItem("grim_banner_dismissed", msg); setDismissed(msg); }} className="text-muted-foreground">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
