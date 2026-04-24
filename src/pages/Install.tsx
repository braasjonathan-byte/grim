import { QRCodeSVG } from "qrcode.react";
import grimIcon from "@/assets/grim-icon.webp";
import { Download, Monitor, Share, MoreVertical, Plus, ChevronRight, ArrowUp, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

type Platform = "ios" | "android" | "desktop";

const detectPlatform = (): Platform => {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
};

// Detects in-app browsers where beforeinstallprompt never fires
const detectInAppBrowser = (): string | null => {
  const ua = navigator.userAgent || "";
  if (/Instagram|IGAB|IABMV/i.test(ua)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "Facebook";
  if (/Snapchat|Snap\//i.test(ua)) return "Snapchat";
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return "TikTok";
  if (/Line\//i.test(ua)) return "Line";
  if (/Twitter|TwitterAndroid/i.test(ua)) return "Twitter/X";
  if (/; wv\)/i.test(ua)) return "in-app browser";
  return null;
};

// Detects Android browser brand for tailored guide
const detectAndroidBrowser = (): "chrome" | "samsung" | "firefox" | "opera" | "edge" | "other" => {
  const ua = navigator.userAgent || "";
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/EdgA|Edg\//i.test(ua)) return "edge";
  if (/OPR\/|Opera/i.test(ua)) return "opera";
  if (/Firefox|FxiOS/i.test(ua)) return "firefox";
  if (/Chrome\//i.test(ua) && !/wv/i.test(ua)) return "chrome";
  return "other";
};

const isStandalone = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
};

/* ── iOS share icon (box with arrow) ── */
const IosShareIcon = () => (
  <div className="w-12 h-12 rounded-xl bg-[#007AFF] flex items-center justify-center shadow-lg">
    <ArrowUp className="w-6 h-6 text-white" strokeWidth={2.5} />
  </div>
);

/* ── Android three-dot menu icon ── */
const AndroidMenuIcon = () => (
  <div className="w-12 h-12 rounded-xl bg-[#4285F4] flex items-center justify-center shadow-lg">
    <MoreVertical className="w-6 h-6 text-white" strokeWidth={2.5} />
  </div>
);

/* ── "Add to Home Screen" icon ── */
const AddHomeIcon = () => (
  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shadow border border-border">
    <Plus className="w-6 h-6 text-foreground" strokeWidth={2} />
  </div>
);

/* ── Install icon ── */
const InstallIcon = () => (
  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shadow border border-border">
    <Download className="w-6 h-6 text-foreground" strokeWidth={2} />
  </div>
);

interface StepProps {
  stepNumber: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  hint?: string;
}

const StepCard = ({ stepNumber, icon, title, description, hint }: StepProps) => (
  <div className="flex gap-4 items-start">
    <div className="flex flex-col items-center gap-1">
      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
        {stepNumber}
      </div>
      {stepNumber < 3 && <div className="w-0.5 h-8 bg-border" />}
    </div>
    <div className="flex-1 pb-4">
      <div className="flex items-center gap-3 mb-1.5">
        {icon}
        <div>
          <p className="font-semibold text-foreground text-sm leading-tight">{title}</p>
          <p className="text-muted-foreground text-xs mt-0.5">{description}</p>
        </div>
      </div>
      {hint && (
        <div className="mt-2 ml-[60px] text-[11px] text-muted-foreground bg-secondary/60 rounded-lg px-3 py-1.5 inline-block">
          {hint}
        </div>
      )}
    </div>
  </div>
);

/* ── Mock Safari bottom bar ── */
const SafariBarMock = () => (
  <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
    <div className="px-3 py-2 border-b border-border bg-muted/30">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-muted" />
        <div className="flex-1 h-7 rounded-lg bg-muted/50 flex items-center px-2">
          <span className="text-[10px] text-muted-foreground">grim.lovable.app</span>
        </div>
        <div className="w-4 h-4 rounded bg-muted" />
      </div>
    </div>
    <div className="flex items-center justify-around py-2.5 px-4">
      <div className="w-5 h-5 rounded bg-muted/40" />
      <div className="w-5 h-5 rounded bg-muted/40" />
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded bg-[#007AFF]/20 flex items-center justify-center ring-2 ring-[#007AFF] ring-offset-1 ring-offset-background">
          <ArrowUp className="w-4 h-4 text-[#007AFF]" strokeWidth={2.5} />
        </div>
        <span className="text-[8px] text-[#007AFF] font-bold mt-0.5">Tryck här</span>
      </div>
      <div className="w-5 h-5 rounded bg-muted/40" />
      <div className="w-5 h-5 rounded bg-muted/40" />
    </div>
  </div>
);

/* ── Mock Chrome top bar ── */
const ChromeBarMock = () => (
  <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
    <div className="flex items-center gap-2 px-3 py-2.5">
      <div className="w-4 h-4 rounded bg-muted/40" />
      <div className="flex-1 h-7 rounded-full bg-muted/50 flex items-center px-3">
        <span className="text-[10px] text-muted-foreground">grim.lovable.app</span>
      </div>
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded bg-[#4285F4]/20 flex items-center justify-center ring-2 ring-[#4285F4] ring-offset-1 ring-offset-background">
          <MoreVertical className="w-4 h-4 text-[#4285F4]" strokeWidth={2.5} />
        </div>
        <span className="text-[8px] text-[#4285F4] font-bold mt-0.5">Tryck här</span>
      </div>
    </div>
  </div>
);

const Install = () => {
  const appUrl = "https://grim.lovable.app";
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [inAppBrowser, setInAppBrowser] = useState<string | null>(null);
  const [androidBrowser, setAndroidBrowser] = useState<ReturnType<typeof detectAndroidBrowser>>("chrome");
  const [installing, setInstalling] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInAppBrowser(detectInAppBrowser());
    setAndroidBrowser(detectAndroidBrowser());
    setInstalled(isStandalone());

    // Capture beforeinstallprompt — may fire before mount, so also stash globally
    const stashed = (window as any).__deferredInstallPrompt;
    if (stashed) setDeferredPrompt(stashed);

    const handler = (e: Event) => {
      e.preventDefault();
      (window as any).__deferredInstallPrompt = e;
      setDeferredPrompt(e);
    };
    const installedHandler = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      (window as any).__deferredInstallPrompt = null;
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      setInstalling(true);
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === "accepted") {
        setInstalled(true);
      }
      setDeferredPrompt(null);
      (window as any).__deferredInstallPrompt = null;
    } catch (err) {
      console.error("[Install] prompt failed", err);
    } finally {
      setInstalling(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const openInChrome = () => {
    // Android intent to open the page in Chrome from an in-app browser
    const url = appUrl.replace(/^https?:\/\//, "");
    window.location.href = `intent://${url}#Intent;scheme=https;package=com.android.chrome;end`;
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center">
      {/* Header */}
      <img src={grimIcon} alt="Grim" className="w-16 h-16 rounded-2xl mb-3 shadow-lg" />
      <h1 className="text-xl font-bold text-foreground mb-0.5">Installera Grim</h1>
      <p className="text-muted-foreground text-xs mb-6 max-w-xs">
        Lägg till appen på din hemskärm – den fungerar precis som en vanlig app.
      </p>

      {/* Already installed */}
      {installed && (
        <div className="w-full max-w-sm bg-primary/10 border border-primary/30 rounded-xl p-4 mb-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">Appen är redan installerad</p>
            <p className="text-[11px] text-muted-foreground">Öppna Grim från din hemskärm.</p>
          </div>
        </div>
      )}

      {/* In-app browser warning (Android) — beforeinstallprompt won't fire here */}
      {!installed && platform === "android" && inAppBrowser && (
        <div className="w-full max-w-sm bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-4 text-left">
          <p className="text-sm font-semibold text-foreground mb-1">
            Du surfar i {inAppBrowser}
          </p>
          <p className="text-[11px] text-muted-foreground mb-3">
            Det går inte att installera appen härifrån. Öppna sidan i Chrome för att kunna installera.
          </p>
          <button
            onClick={openInChrome}
            className="w-full bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-lg text-sm active:scale-95 transition-transform"
          >
            Öppna i Chrome
          </button>
          <button
            onClick={handleCopyLink}
            className="w-full mt-2 bg-muted text-foreground font-medium px-4 py-2 rounded-lg text-xs active:scale-95 transition-transform"
          >
            {copied ? "Länk kopierad ✓" : "Kopiera länk"}
          </button>
        </div>
      )}

      {/* Android native install button */}
      {!installed && deferredPrompt && (
        <button
          onClick={handleInstall}
          disabled={installing}
          className="flex items-center gap-2 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl text-base mb-6 hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-60"
        >
          <Download className="w-5 h-5" /> {installing ? "Installerar…" : "Installera appen"}
        </button>
      )}

      {/* Android native install button */}
      {deferredPrompt && (
        <button
          onClick={handleInstall}
          className="flex items-center gap-2 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl text-base mb-6 hover:opacity-90 transition-opacity active:scale-95"
        >
          <Download className="w-5 h-5" /> Installera appen
        </button>
      )}

      {/* ── iOS Guide ── */}
      {platform === "ios" && (
        <div className="w-full max-w-sm space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🍎</span>
            <h2 className="text-sm font-bold text-foreground">Så installerar du på iPhone</h2>
          </div>

          <SafariBarMock />

          <div className="bg-card border border-border rounded-xl p-4 text-left">
            <StepCard
              stepNumber={1}
              icon={<IosShareIcon />}
              title="Tryck på Dela-knappen"
              description="Den fyrkantiga ikonen med en pil uppåt, längst ner i Safari."
            />
            <StepCard
              stepNumber={2}
              icon={<AddHomeIcon />}
              title={`Välj "Lägg till på hemskärmen"`}
              description="Scrolla ner i menyn tills du hittar alternativet."
              hint="Ikonen ser ut som en ➕ med texten bredvid"
            />
            <StepCard
              stepNumber={3}
              icon={
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <img src={grimIcon} alt="" className="w-8 h-8 rounded-lg" />
                </div>
              }
              title={`Tryck "Lägg till"`}
              description="Grim dyker nu upp som en app på din hemskärm!"
            />
          </div>

          <p className="text-muted-foreground text-[11px]">
            ⚠️ Du måste använda <span className="font-semibold text-foreground">Safari</span> – det fungerar inte i Chrome eller andra webbläsare på iPhone.
          </p>
        </div>
      )}

      {/* ── Android Guide ── */}
      {!installed && platform === "android" && !deferredPrompt && !inAppBrowser && (
        <div className="w-full max-w-sm space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🤖</span>
            <h2 className="text-sm font-bold text-foreground">Så installerar du på Android</h2>
          </div>

          <ChromeBarMock />

          <div className="bg-card border border-border rounded-xl p-4 text-left">
            <StepCard
              stepNumber={1}
              icon={<AndroidMenuIcon />}
              title={
                androidBrowser === "samsung"
                  ? "Tryck på ☰ menyn"
                  : androidBrowser === "firefox"
                  ? "Tryck på ⋮ menyn"
                  : "Tryck på ⋮ menyn"
              }
              description={
                androidBrowser === "samsung"
                  ? "Linjerna nere till höger i Samsung Internet."
                  : androidBrowser === "firefox"
                  ? "De tre prickarna nere till höger i Firefox."
                  : androidBrowser === "edge"
                  ? "De tre prickarna nere i mitten i Edge."
                  : androidBrowser === "opera"
                  ? "Opera-loggan eller ⋮ nere till höger."
                  : "De tre prickarna uppe till höger i Chrome."
              }
            />
            <StepCard
              stepNumber={2}
              icon={<InstallIcon />}
              title={
                androidBrowser === "samsung"
                  ? `Välj "Lägg till sida på" → "Startskärm"`
                  : `Välj "Installera app"`
              }
              description={
                androidBrowser === "samsung"
                  ? "Samsung Internet kallar det inte alltid 'installera' – men resultatet blir samma."
                  : `Alternativt "Lägg till på startskärmen" om du inte ser "Installera app".`
              }
            />
            <StepCard
              stepNumber={3}
              icon={
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <img src={grimIcon} alt="" className="w-8 h-8 rounded-lg" />
                </div>
              }
              title="Bekräfta installationen"
              description="Grim visas nu som en app bland dina övriga appar!"
            />
          </div>

          {androidBrowser !== "chrome" && androidBrowser !== "samsung" && androidBrowser !== "edge" && (
            <div className="bg-muted/40 border border-border rounded-lg p-3 text-left">
              <p className="text-[11px] text-muted-foreground">
                💡 Din webbläsare har begränsat stöd för installation. Om det inte fungerar – öppna sidan i <span className="font-semibold text-foreground">Chrome</span>.
              </p>
              <button
                onClick={openInChrome}
                className="mt-2 text-xs text-primary font-semibold underline"
              >
                Öppna i Chrome
              </button>
            </div>
          )}

          <p className="text-muted-foreground text-[11px]">
            💡 Använd <span className="font-semibold text-foreground">Chrome</span> eller <span className="font-semibold text-foreground">Samsung Internet</span> för bästa resultat.
          </p>
        </div>
      )}

      {/* ── Desktop Guide ── */}
      {platform === "desktop" && (
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white p-4 rounded-2xl shadow-lg">
              <QRCodeSVG value={appUrl} size={180} level="H" includeMargin={false} />
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Monitor className="w-4 h-4" />
              <span>Skanna QR-koden med din mobil</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] text-muted-foreground">ELLER</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-xl p-3 text-left">
              <span className="text-lg mb-1 block">🍎</span>
              <p className="text-xs font-semibold text-foreground mb-1">iPhone</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Öppna i Safari → Dela-knappen → "Lägg till på hemskärmen"
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-left">
              <span className="text-lg mb-1 block">🤖</span>
              <p className="text-xs font-semibold text-foreground mb-1">Android</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Öppna i Chrome → ⋮ meny → "Installera app"
              </p>
            </div>
          </div>
        </div>
      )}

      <a
        href={appUrl}
        className="mt-8 text-sm text-primary font-medium hover:underline flex items-center gap-1"
      >
        Öppna appen i webbläsaren <ChevronRight className="w-4 h-4" />
      </a>

      <p className="text-muted-foreground/40 text-[10px] mt-6">grim.lovable.app</p>
    </div>
  );
};

export default Install;
