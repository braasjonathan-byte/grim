import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const detectInAppBrowser = (): "instagram" | "snapchat" | null => {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  if (/Instagram/i.test(ua)) return "instagram";
  if (/Snapchat/i.test(ua)) return "snapchat";
  return null;
};

const DISMISS_KEY = "grim_inapp_browser_dismissed";

export const InAppBrowserDialog = () => {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<"instagram" | "snapchat" | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const detected = detectInAppBrowser();
    if (!detected) return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    setSource(detected);
    setOpen(true);
  }, []);

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  const handleOpenExternal = () => {
    if (isAndroid) {
      // Android intent to force Chrome
      const url = currentUrl.replace(/^https?:\/\//, "");
      window.location.href = `intent://${url}#Intent;scheme=https;package=com.android.chrome;end`;
    } else {
      // iOS: try x-safari scheme
      window.location.href = `x-safari-${currentUrl}`;
      setTimeout(() => {
        // Fallback — copy and instruct
        handleCopy();
      }, 500);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      toast.success("Länk kopierad");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kunde inte kopiera länken");
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  if (!source) return null;

  const sourceName = source === "instagram" ? "Instagram" : "Snapchat";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDismiss()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Öppna i din webbläsare</DialogTitle>
          <DialogDescription>
            Du har öppnat Grim via {sourceName}s inbyggda webbläsare. För bästa upplevelse — inloggning, notiser och installation som app — rekommenderar vi att du öppnar appen i {isAndroid ? "Chrome" : "Safari"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {isAndroid ? (
            <Button onClick={handleOpenExternal} className="w-full gap-2">
              <ExternalLink className="h-4 w-4" />
              Öppna i Chrome
            </Button>
          ) : (
            <>
              <div className="rounded-none border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground">Så här gör du:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Tryck på menyn (•••) uppe till höger</li>
                  <li>Välj "Öppna i extern webbläsare" eller "Öppna i Safari"</li>
                </ol>
                <p>Eller kopiera länken och klistra in i Safari:</p>
              </div>
              <Button onClick={handleCopy} variant="outline" className="w-full gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Kopierad" : "Kopiera länk"}
              </Button>
            </>
          )}

          <Button onClick={handleDismiss} variant="ghost" className="w-full">
            Fortsätt ändå
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
