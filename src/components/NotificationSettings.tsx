import { useState, useEffect } from "react";
import { Bell, BellOff, ExternalLink, Loader2, Check, Clock, AlarmClock } from "lucide-react";
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

const REMINDER_TIMES = [
  "05:00", "05:30", "06:00", "06:30", "07:00", "07:30",
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00",
];

const NotificationSettings = ({ userId }: NotificationSettingsProps) => {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [hasSubscription, setHasSubscription] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(true);
  const [justEnabled, setJustEnabled] = useState(false);

  // Reminder state
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("07:00");
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderSaved, setReminderSaved] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      return;
    }
    setPermission(Notification.permission);
    checkSubscription();
    loadReminder();
  }, [userId]);

  const loadReminder = async () => {
    const { data } = await supabase
      .from("workout_reminders")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      setReminderEnabled(data.enabled);
      setReminderTime(data.reminder_time?.substring(0, 5) || "07:00");
    }
  };

  const saveReminder = async (enabled: boolean, time: string) => {
    setReminderLoading(true);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Stockholm";

    const { data: existing } = await supabase
      .from("workout_reminders")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("workout_reminders")
        .update({ enabled, reminder_time: time, timezone })
        .eq("user_id", userId);
    } else {
      await supabase
        .from("workout_reminders")
        .insert({ user_id: userId, enabled, reminder_time: time, timezone });
    }

    setReminderEnabled(enabled);
    setReminderTime(time);
    setReminderLoading(false);
    setReminderSaved(true);
    setTimeout(() => setReminderSaved(false), 2000);
  };

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration) {
        const sub = await (registration as any).pushManager.getSubscription();
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
        const registration = await navigator.serviceWorker.ready;
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
        const endpoint = subJson.endpoint!;
        const p256dh = subJson.keys?.p256dh || "";
        const auth = subJson.keys?.auth || "";

        await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
        await supabase.from("push_subscriptions").insert({
          user_id: userId,
          endpoint,
          p256dh,
          auth,
        });

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
      window.open("intent:#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;S.android.provider.extra.APP_PACKAGE=com.android.chrome;end", "_blank");
    }
  };

  const isEnabled = permission === "granted" && hasSubscription;
  const isDenied = permission === "denied";

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
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
            Du får notiser när admin publicerar meddelanden, när vänner slutför träningspass och när någon kommenterar ditt pass.
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

      {/* Workout Reminder Section */}
      {isEnabled && (
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlarmClock className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-bold">⏰ Träningspåminnelse</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Få en påminnelse på dagar då du har ett planerat pass. Påminnelsen skickas inte om du redan har registrerat passet.
          </p>

          <div className="flex items-center justify-between">
            <span className="text-sm">Aktivera påminnelse</span>
            <button
              onClick={() => saveReminder(!reminderEnabled, reminderTime)}
              disabled={reminderLoading}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                reminderEnabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
                  reminderEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {reminderEnabled && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Tid för påminnelse
              </label>
              <select
                value={reminderTime}
                onChange={(e) => saveReminder(true, e.target.value)}
                className="w-full bg-secondary text-foreground text-sm p-2.5 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary"
              >
                {REMINDER_TIMES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}

          {reminderSaved && (
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <Check className="w-3.5 h-3.5" />
              <span>Sparat!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationSettings;
