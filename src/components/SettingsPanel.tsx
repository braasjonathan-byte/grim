import { useState, useEffect, useRef, lazy, Suspense, useCallback } from "react";
import { Check, Loader2, ShieldQuestion, ChevronDown, Smartphone, Mail, KeyRound, LogOut, Music, Volume2, Link2, Unlink, RefreshCw } from "lucide-react";
import ThemePicker from "@/components/ThemePicker";
import { getStoredThemeId } from "@/lib/themes";
import { supabase } from "@/integrations/supabase/client";

const ChangePassword = lazy(() => import("@/components/ChangePassword"));
import ReceiptsList from "@/components/ReceiptsList";


export const SECURITY_QUESTIONS = [
  "Vad hette ditt första husdjur?",
  "Vilken stad föddes du i?",
  "Vad hette din bästa vän i barndomen?",
  "Vad är din mammas flicknamn?",
  "Vilken var din första skola?",
  "Vad heter din favoritfilm?",
  "Vilken gata växte du upp på?",
  "Vad är ditt favoritlag?",
];

interface SettingsPanelProps {
  userId?: string;
  isAdmin?: boolean;
  isHonorary?: boolean;
}

const SettingsPanel = ({ userId, isAdmin, isHonorary = false }: SettingsPanelProps) => {
  const [colorTheme, setColorTheme] = useState(getStoredThemeId());

  const [wakeLock, setWakeLock] = useState(() => {
    return localStorage.getItem("gymberget_wakelock") === "true";
  });
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const [securityOpen, setSecurityOpen] = useState(false);
  const [secQuestions, setSecQuestions] = useState<(number | null)[]>([null, null, null, null]);
  const [secAnswers, setSecAnswers] = useState<string[]>(["", "", "", ""]);
  const [secSaving, setSecSaving] = useState(false);
  const [secSaved, setSecSaved] = useState(false);
  const [secHasExisting, setSecHasExisting] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [spotifyWidget, setSpotifyWidget] = useState(() => {
    return localStorage.getItem("gymberget_spotify_widget") !== "false";
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("gymberget_sound_enabled") !== "false";
  });

  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailDirty, setEmailDirty] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [stravaLoading, setStravaLoading] = useState(false);
  const [stravaConnecting, setStravaConnecting] = useState(false);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaName, setStravaName] = useState("");
  const [stravaSyncing, setStravaSyncing] = useState(false);
  const [stravaSyncMessage, setStravaSyncMessage] = useState("");
  const [stravaSyncStatus, setStravaSyncStatus] = useState({
    lastSyncedAt: "" as string | null,
    lastAttemptAt: "" as string | null,
    lastImportedCount: 0,
    totalImported: 0,
    lastError: "" as string | null,
  });

  const refreshStravaConnection = useCallback(async () => {
    if (!userId) return;
    setStravaLoading(true);
    const { data } = await (supabase as any).rpc("get_my_strava_connection");
    const connection = data?.[0];
    setStravaConnected(!!connection?.connected);
    setStravaName([connection?.athlete_firstname, connection?.athlete_lastname].filter(Boolean).join(" ") || connection?.athlete_username || "Strava");
    setStravaSyncStatus({
      lastSyncedAt: connection?.last_synced_at ?? null,
      lastAttemptAt: connection?.last_sync_attempt_at ?? null,
      lastImportedCount: connection?.last_sync_imported_count ?? 0,
      totalImported: connection?.total_imported_activities ?? 0,
      lastError: connection?.last_sync_error ?? null,
    });
    setStravaLoading(false);
  }, [userId]);

  // Dark/light mode is now handled by the theme system via applyTheme()

  useEffect(() => {
    const requestWakeLock = async () => {
      if (wakeLock && "wakeLock" in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
          wakeLockRef.current.addEventListener("release", () => {
            wakeLockRef.current = null;
          });
        } catch {
          // Wake lock request failed
        }
      } else if (!wakeLock && wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };

    localStorage.setItem("gymberget_wakelock", wakeLock ? "true" : "false");
    requestWakeLock();

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && wakeLock && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [wakeLock]);

  useEffect(() => {
    if (!userId) return;
    supabase
      .rpc("get_my_security_question_indices")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSecHasExisting(true);
          const qs: (number | null)[] = [null, null, null, null];
          (data as { question_index: number }[]).forEach((row, i) => {
            if (i < 4) qs[i] = row.question_index;
          });
          setSecQuestions(qs);
        }
      });
    // Fetch existing email
    supabase
      .from("user_emails")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.email) {
          setEmail(data.email);
          setHasEmail(true);
        }
      });
    refreshStravaConnection();
  }, [userId, refreshStravaConnection]);

  useEffect(() => {
    if (!userId) return;
    const handleFocus = () => refreshStravaConnection();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshStravaConnection();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [userId, refreshStravaConnection]);

  const handleSaveSecurityQuestions = async () => {
    if (!userId) return;
    for (let i = 0; i < 4; i++) {
      if (secQuestions[i] === null || !secAnswers[i].trim()) return;
    }
    const qSet = new Set(secQuestions);
    if (qSet.size < 4) return;

    setSecSaving(true);
    const { data, error } = await supabase.functions.invoke("reset-password", {
      body: {
        nickname: "_save_",
        action: "save-answers",
        questionIndices: secQuestions,
        answerTexts: secAnswers.map(a => a.trim()),
      },
    });

    if (!error && data?.success) {
      setSecSaved(true);
      setSecHasExisting(true);
      setSecAnswers(["", "", "", ""]);
      setTimeout(() => setSecSaved(false), 2000);
    }
    setSecSaving(false);
  };

  const allSecFilled = secQuestions.every((q) => q !== null) &&
    secAnswers.every((a) => a.trim().length > 0) &&
    new Set(secQuestions).size === 4;

  const handleSaveEmail = async () => {
    if (!userId || !email.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) return;

    setEmailSaving(true);
    if (hasEmail) {
      await supabase
        .from("user_emails")
        .update({ email: email.trim() })
        .eq("user_id", userId);
    } else {
      await supabase
        .from("user_emails")
        .insert({ user_id: userId, email: email.trim() });
    }
    setHasEmail(true);
    setEmailSaved(true);
    setEmailDirty(false);
    setTimeout(() => setEmailSaved(false), 2000);
    setEmailSaving(false);
  };

  const handleConnectStrava = async () => {
    if (!userId) return;
    const authWindow = window.open("", "_blank");
    if (authWindow) {
      authWindow.document.write("<p style='font-family: system-ui; padding: 24px;'>Öppnar Strava...</p>");
    }
    setStravaConnecting(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setStravaConnecting(false);
      authWindow?.close();
      alert("Du behöver logga in igen innan Strava kan kopplas.");
      return;
    }
    const { data, error } = await supabase.functions.invoke("strava-oauth-start", {
      body: { redirectOrigin: window.location.origin },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setStravaConnecting(false);
    if (error || !data?.authUrl) {
      authWindow?.close();
      const message = data?.error || error?.message || "Försök igen.";
      alert(`Kunde inte starta Strava-kopplingen. ${message}`);
      return;
    }
    if (authWindow) {
      authWindow.location.href = data.authUrl;
    } else {
      window.location.assign(data.authUrl);
    }
  };

  const handleDisconnectStrava = async () => {
    if (!userId || !confirm("Koppla bort Strava från ditt konto?")) return;
    setStravaLoading(true);
    await supabase.from("strava_connections").delete().eq("user_id", userId);
    setStravaConnected(false);
    setStravaName("");
    setStravaLoading(false);
  };

  const handleSyncStravaNow = async () => {
    if (!userId || !stravaConnected) return;
    setStravaSyncing(true);
    setStravaSyncMessage("");
    const { data, error } = await supabase.functions.invoke("strava-sync", {
      body: { mode: "user", limit: 1, source: "settings-sync-now" },
    });
    setStravaSyncing(false);
    if (error || data?.error) {
      setStravaSyncMessage("Synken misslyckades. Försök igen.");
      return;
    }
    const imported = data?.results?.[0]?.imported ?? 0;
    const resultError = data?.results?.[0]?.error ?? null;
    const nowIso = new Date().toISOString();
    setStravaSyncStatus((status) => ({
      lastSyncedAt: resultError ? status.lastSyncedAt : nowIso,
      lastAttemptAt: nowIso,
      lastImportedCount: imported,
      totalImported: status.totalImported + imported,
      lastError: resultError,
    }));
    setStravaSyncMessage(imported > 0 ? `${imported} nya aktiviteter importerade.` : "Inga nya aktiviteter hittades.");
  };

  const formatSyncTime = (value?: string | null) => {
    if (!value) return "Aldrig";
    return new Intl.DateTimeFormat("sv-SE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  };

  const getAvailableQuestions = (slotIndex: number) => {
    const selected = secQuestions.filter((q, i) => i !== slotIndex && q !== null);
    return SECURITY_QUESTIONS.map((q, idx) => ({
      idx,
      text: q,
      disabled: selected.includes(idx),
    }));
  };

  return (
    <div className="bg-background border border-border rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-bold font-sans">⚙️ Inställningar</h3>

      {/* Theme picker - replaces old dark mode toggle */}
      {userId && (
        <ThemePicker
          userId={userId}
          isHonorary={isHonorary}
          currentTheme={colorTheme}
          onThemeChange={setColorTheme}
        />
      )}

      {/* Wake lock toggle */}
      {"wakeLock" in navigator && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" />
            <span className="text-sm">Håll skärmen vaken</span>
          </div>
          <button
            onClick={() => setWakeLock(!wakeLock)}
            className={`relative w-11 h-6 rounded-full transition-colors ${wakeLock ? "bg-primary" : "bg-secondary border border-border"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${wakeLock ? "translate-x-5 bg-primary-foreground" : "translate-x-0 bg-muted-foreground"}`} />
          </button>
        </div>
      )}

      {/* Spotify widget toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-primary" />
          <span className="text-sm">Visa Spotify i träningsvyn</span>
        </div>
        <button
          onClick={() => {
            const next = localStorage.getItem("gymberget_spotify_widget") !== "true";
            localStorage.setItem("gymberget_spotify_widget", next ? "true" : "false");
            setSpotifyWidget(next);
          }}
          className={`relative w-11 h-6 rounded-full transition-colors ${spotifyWidget ? "bg-primary" : "bg-secondary border border-border"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${spotifyWidget ? "translate-x-5 bg-primary-foreground" : "translate-x-0 bg-muted-foreground"}`} />
        </button>
      </div>

      {/* Sound feedback toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-primary" />
          <span className="text-sm">Ljud-feedback</span>
        </div>
        <button
          onClick={() => {
            const next = !soundEnabled;
            localStorage.setItem("gymberget_sound_enabled", next ? "true" : "false");
            setSoundEnabled(next);
          }}
          className={`relative w-11 h-6 rounded-full transition-colors ${soundEnabled ? "bg-primary" : "bg-secondary border border-border"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${soundEnabled ? "translate-x-5 bg-primary-foreground" : "translate-x-0 bg-muted-foreground"}`} />
        </button>
      </div>

      {userId && (
        <div className="border-t border-border pt-2">
          <button
            onClick={() => setSecurityOpen(!securityOpen)}
            className="w-full flex items-center justify-between py-2"
          >
            <div className="flex items-center gap-2">
              <ShieldQuestion className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Säkerhetsfrågor</span>
              {secHasExisting && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Sparade</span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${securityOpen ? "rotate-180" : ""}`} />
          </button>
          {securityOpen && (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-muted-foreground">
                Välj 4 frågor och fyll i svar. Dessa används vid lösenordsåterställning.
              </p>

              {[0, 1, 2, 3].map((slot) => (
                <div key={slot} className="space-y-1">
                  <select
                    value={secQuestions[slot] ?? ""}
                    onChange={(e) => {
                      const newQs = [...secQuestions];
                      newQs[slot] = e.target.value === "" ? null : parseInt(e.target.value);
                      setSecQuestions(newQs);
                    }}
                    className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Välj fråga {slot + 1}...</option>
                    {getAvailableQuestions(slot).map((q) => (
                      <option key={q.idx} value={q.idx} disabled={q.disabled}>
                        {q.text}
                      </option>
                    ))}
                  </select>
                  {secQuestions[slot] !== null && (
                    <input
                      type="text"
                      value={secAnswers[slot]}
                      onChange={(e) => {
                        const newAs = [...secAnswers];
                        newAs[slot] = e.target.value;
                        setSecAnswers(newAs);
                      }}
                      placeholder="Ditt svar..."
                      maxLength={100}
                      className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                    />
                  )}
                </div>
              ))}

              <button
                onClick={handleSaveSecurityQuestions}
                disabled={!allSecFilled || secSaving}
                className="w-full py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
              >
                {secSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : secSaved ? (
                  <><Check className="w-4 h-4" /> Sparade!</>
                ) : (
                  secHasExisting ? "Uppdatera säkerhetsfrågor" : "Spara säkerhetsfrågor"
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Email for password recovery */}
      {userId && (
        <div className="border-t border-border pt-2">
          <button
            onClick={() => setEmailOpen(!emailOpen)}
            className="w-full flex items-center justify-between py-2"
          >
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">E-post för återställning</span>
              {hasEmail && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Kopplad</span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${emailOpen ? "rotate-180" : ""}`} />
          </button>
          {emailOpen && (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-muted-foreground">
                Koppla en e-postadress som kan användas vid lösenordsåterställning om du inte har säkerhetsfrågor.
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailDirty(true); }}
                placeholder="din@email.com"
                className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              />
              {emailDirty && (
                <button
                  onClick={handleSaveEmail}
                  disabled={emailSaving || !email.trim()}
                  className="w-full py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
                >
                  {emailSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : emailSaved ? (
                    <><Check className="w-4 h-4" /> Sparad!</>
                  ) : (
                    hasEmail ? "Uppdatera e-post" : "Spara e-post"
                  )}
                </button>
              )}
              {emailSaved && !emailDirty && (
                <p className="text-xs text-center text-primary flex items-center justify-center gap-1">
                  <Check className="w-3 h-3" /> Sparad!
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {userId && (
        <div className="border-t border-border pt-2">
          <div className="flex items-center justify-between gap-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <Link2 className="w-4 h-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">Strava</p>
                <p className="truncate text-xs text-muted-foreground">
                  {stravaConnected ? `Kopplad${stravaName ? `: ${stravaName}` : ""}` : "Koppla ditt Strava-konto"}
                </p>
              </div>
            </div>
            {stravaConnected ? (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncStravaNow}
                  disabled={stravaSyncing || stravaLoading}
                  className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {stravaSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Sync now
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectStrava}
                  disabled={stravaLoading || stravaSyncing}
                  className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  {stravaLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                  Koppla bort
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectStrava}
                disabled={stravaConnecting || stravaLoading}
                className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {stravaConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                Connect with Strava
              </button>
            )}
          </div>
          {stravaConnected && (
            <div className="mb-2 grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/40 p-3 text-xs">
              <div>
                <p className="text-muted-foreground">Senast synkad</p>
                <p className="font-semibold text-foreground">{formatSyncTime(stravaSyncStatus.lastSyncedAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Importerade senast</p>
                <p className="font-semibold text-foreground">{stravaSyncStatus.lastImportedCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Totalt importerade</p>
                <p className="font-semibold text-foreground">{stravaSyncStatus.totalImported}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Senaste försök</p>
                <p className="font-semibold text-foreground">{formatSyncTime(stravaSyncStatus.lastAttemptAt)}</p>
              </div>
              {stravaSyncStatus.lastError && (
                <div className="col-span-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-destructive">
                  {stravaSyncStatus.lastError}
                </div>
              )}
            </div>
          )}
          {stravaSyncMessage && (
            <p className="pb-2 text-xs text-muted-foreground">{stravaSyncMessage}</p>
          )}
        </div>
      )}
      {/* Receipts */}
      {userId && <ReceiptsList />}

      {/* Change password */}
      {userId && (
        <div className="border-t border-border pt-2">
          <button
            onClick={() => setShowChangePassword(true)}
            className="w-full flex items-center gap-2 py-2 text-sm font-semibold hover:text-primary transition-colors"
          >
            <KeyRound className="w-4 h-4 text-primary" />
            Byt lösenord
          </button>
        </div>
      )}

      {/* Leave plan */}
      {userId && (
        <div className="border-t border-border pt-2">
          <button
            onClick={async () => {
              if (!confirm("Är du säker? Schemat arkiveras under din profil innan det tas bort.")) return;
              try {
                const [{ data: planData }, { data: compData }] = await Promise.all([
                  supabase.from("workout_plans").select("*").eq("user_id", userId),
                  supabase.from("workout_completions").select("*").eq("user_id", userId),
                ]);
                if (planData && planData.length > 0) {
                  const firstSession = planData.find(p => p.session_name.trim() !== "");
                  const planName = firstSession
                    ? `Schema (${planData.filter(p => p.session_name.trim() !== "").length} pass, ${[...new Set(planData.map(p => p.week))].length} veckor)`
                    : "Schema";
                  const { data: profilePsd } = await supabase.from("profiles").select("plan_start_date").eq("user_id", userId).single();
                  await supabase.from("archived_plans").insert({
                    user_id: userId,
                    plan_name: planName,
                    plan_data: planData as any,
                    completion_data: (compData || []) as any,
                    plan_start_date: (profilePsd as any)?.plan_start_date ?? null,
                  } as any);
                }
              } catch (e) {
                console.error("Failed to archive plan:", e);
              }
              await Promise.all([
                supabase.from("workout_plans").delete().eq("user_id", userId),
                supabase.from("workout_completions").delete().eq("user_id", userId),
              ]);
              window.location.reload();
            }}
            className="w-full flex items-center gap-2 py-2 text-sm font-semibold text-destructive hover:opacity-80 transition-opacity"
          >
            <LogOut className="w-4 h-4" />
            Avsluta nuvarande plan
          </button>
        </div>
      )}

      {showChangePassword && (
        <Suspense fallback={null}>
          <ChangePassword
            onClose={() => setShowChangePassword(false)}
            onChanged={() => setShowChangePassword(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default SettingsPanel;
