import { useState, useEffect } from "react";
import { Bell, BellOff, ExternalLink, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface NotificationSettingsProps {
  userId: string;
}

const NotificationSettings = ({ userId }: NotificationSettingsProps) => {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [hasSubscription, setHasSubscription] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(true);
  const [justEnabled, setJustEnabled] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      return;
    }
    setPermission(Notification.permission);
    checkSubscription();
  }, [userId]);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      if (registration) {
        const mgr = (registration as any).pushManager;
        const sub = mgr ? await mgr.getSubscription() : null;
        setHasSubscription(!!sub);
      }
    } catch {
      // ignore
    }
  };

  const enableNotifications = async () => {
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === "granted") {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const { data: vapidData } = await supabase.functions.invoke("get-vapid-key");
        if (!vapidData?.publicKey) throw new Error("No VAPID key");

        const applicationServerKey = urlBase64ToUint8Array(vapidData.publicKey);
        const mgr = (registration as any).pushManager;
        let subscription = await mgr.getSubscription();

        if (!subscription) {
          subscription = await mgr.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
        }

        const subJson = subscription!.toJSON();
        await supabase.from("push_subscriptions").upsert(
          {
            user_id: userId,
            endpoint: subJson.endpoint!,
            p256dh: subJson.keys?.p256dh || "",
            auth: subJson.keys?.auth || "",
          } as any,
          { onConflict: "user_id,endpoint" }
        );

        setHasSubscription(true);
        setJustEnabled(true);
        setTimeout(() => setJustEnabled(false), 3000);
      }
    } catch (err) {
      console.error("Failed to enable notifications:", err);
    }
    setLoading(false);
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  const openDeviceSettings = () => {
    if (isAndroid) {
      // Android Chrome: open app notification settings
      window.open("intent:#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;S.android.provider.extra.APP_PACKAGE=com.android.chrome;end", "_blank");
    }
    // For iOS and others, we show instructions instead
  };

  const isEnabled = permission === "granted" && hasSubscription;
  const isDenied = permission === "denied";

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        {isEnabled ? (
          <Bell className="w-4 h-4 text-primary" />
        ) : (
          <BellOff className="w-4 h-4 text-muted-foreground" />
        )}
        <h3 className="text-sm font-bold">🔔 Notiser</h3>
      </div>

      {!supported ? (
        <p className="text-xs text-muted-foreground">
          Din webbläsare stödjer inte push-notiser. Installera appen på hemskärmen för att aktivera notiser.
        </p>
      ) : isEnabled ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-sm text-foreground">Notiser är aktiverade</span>
            {justEnabled && <Check className="w-4 h-4 text-primary" />}
          </div>
          <p className="text-xs text-muted-foreground">
            Du får notiser när admin publicerar meddelanden och när vänner slutför träningspass.
          </p>
        </div>
      ) : isDenied ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Notiser är blockerade. Du behöver aktivera dem i enhetens inställningar.
          </p>
          {isIOS ? (
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Så här aktiverar du på iPhone:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Öppna <strong>Inställningar</strong></li>
                <li>Scrolla till <strong>Safari</strong> (eller din webbläsare)</li>
                <li>Tryck på <strong>Notiser</strong></li>
                <li>Aktivera notiser för denna sida</li>
              </ol>
            </div>
          ) : isAndroid ? (
            <button
              onClick={openDeviceSettings}
              className="w-full py-2 bg-secondary text-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Öppna notisinställningar
            </button>
          ) : (
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Så här aktiverar du:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Klicka på låsikonen i adressfältet</li>
                <li>Hitta <strong>Notiser</strong></li>
                <li>Ändra till <strong>Tillåt</strong></li>
              </ol>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Aktivera notiser för att få besked om nya meddelanden och vänners aktivitet.
          </p>
          <button
            onClick={enableNotifications}
            disabled={loading}
            className="w-full py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Bell className="w-4 h-4" />
                Aktivera notiser
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationSettings;
