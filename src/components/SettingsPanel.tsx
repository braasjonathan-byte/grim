import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Moon, Sun, Check, Loader2, ShieldQuestion, ChevronDown, Smartphone, Mail, KeyRound, LogOut, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ChangePassword = lazy(() => import("@/components/ChangePassword"));
import ReceiptsList from "@/components/ReceiptsList";

const THEME_KEY = "gymberget_theme";

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
}

const SettingsPanel = ({ userId, isAdmin }: SettingsPanelProps) => {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

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

  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailDirty, setEmailDirty] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", dark ? "#000000" : "#ffffff");
    }
  }, [dark]);

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
  }, [userId]);

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
      <h3 className="text-sm font-bold">⚙️ Inställningar</h3>

      {/* Theme toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {dark ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-primary" />}
          <span className="text-sm">Mörkt läge</span>
        </div>
        <button
          onClick={() => setDark(!dark)}
          className={`relative w-11 h-6 rounded-full transition-colors ${dark ? "bg-primary" : "bg-secondary border border-border"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${dark ? "translate-x-5 bg-primary-foreground" : "translate-x-0 bg-muted-foreground"}`} />
        </button>
      </div>

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
