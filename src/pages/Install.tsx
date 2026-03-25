import { QRCodeSVG } from "qrcode.react";
import grimIcon from "@/assets/grim-icon.webp";
import { Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

const Install = () => {
  const appUrl = "https://grim.lovable.app";
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    setIsAndroid(/android/.test(ua));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center">
      <img src={grimIcon} alt="Grim" className="w-20 h-20 rounded-2xl mb-4" />
      <h1 className="text-2xl font-bold text-foreground mb-1">Grim – Träningsapp</h1>
      <p className="text-muted-foreground text-sm mb-8 max-w-xs">
        Spåra träning, följ vänner, beräkna 1RM och pulszoner.
      </p>

      {/* QR code – visible on desktop */}
      <div className="hidden md:flex flex-col items-center gap-3 mb-8">
        <div className="bg-white p-4 rounded-2xl shadow-lg">
          <QRCodeSVG value={appUrl} size={200} level="H" includeMargin={false} />
        </div>
        <p className="text-muted-foreground text-xs">Skanna med mobilen för att installera</p>
      </div>

      {/* Install button – Android */}
      {deferredPrompt && (
        <button
          onClick={handleInstall}
          className="flex items-center gap-2 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl text-base mb-4 hover:opacity-90 transition-opacity active:scale-95"
        >
          <Download className="w-5 h-5" /> Installera appen
        </button>
      )}

      {/* Instructions */}
      <div className="w-full max-w-sm space-y-4">
        {(isIOS || !isAndroid) && (
          <div className="bg-card border border-border rounded-xl p-4 text-left">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-sm text-foreground">iPhone / iPad</span>
            </div>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Öppna <span className="font-medium text-foreground">Safari</span></li>
              <li>Tryck på <span className="font-medium text-foreground">Dela-ikonen</span> (rutan med pil upp)</li>
              <li>Välj <span className="font-medium text-foreground">"Lägg till på hemskärmen"</span></li>
            </ol>
          </div>
        )}

        {(isAndroid || !isIOS) && (
          <div className="bg-card border border-border rounded-xl p-4 text-left">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-sm text-foreground">Android</span>
            </div>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Öppna <span className="font-medium text-foreground">Chrome</span></li>
              <li>Tryck på <span className="font-medium text-foreground">⋮ menyn</span> uppe till höger</li>
              <li>Välj <span className="font-medium text-foreground">"Installera app"</span> eller <span className="font-medium text-foreground">"Lägg till på startskärmen"</span></li>
            </ol>
          </div>
        )}
      </div>

      <a
        href={appUrl}
        className="mt-6 text-sm text-primary font-medium hover:underline"
      >
        Öppna appen i webbläsaren →
      </a>

      <p className="text-muted-foreground/50 text-[10px] mt-8">grim.lovable.app</p>
    </div>
  );
};

export default Install;
