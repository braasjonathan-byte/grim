import { lazyRetry } from "@/lib/lazyRetry";
import { useAccessLevel } from "@/hooks/useAccessLevel";
import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { toast } from "sonner";
import { Check, Loader2, ChevronDown, Smartphone, Mail, KeyRound, LogOut, Volume2, Fingerprint, BarChart3, Dumbbell, Trash2, Timer } from "lucide-react";
import { isFastingEnabled, setFastingEnabled } from "@/components/FastingWidget";
import ThemePicker from "@/components/ThemePicker";
import { getStoredThemeId } from "@/lib/themes";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { isBiometricSupported, isBiometricEnabled, enableBiometric, disableBiometric } from "@/lib/biometric";
import { CARDIO_CATEGORIES, useCardioVisibility } from "@/lib/cardioVisibility";
import { STATS_SECTIONS, WEIGHT_RANGES, useStatsSettings } from "@/lib/statsSettings";
import { isWakeLockEnabled, isWakeLockSupported, setWakeLockEnabled, subscribeWakeLock } from "@/lib/wakeLock";


const AdminPanel = lazyRetry(() => import("@/components/admin/AdminPanel"));
const ChangePassword = lazyRetry(() => import("@/components/ChangePassword"));
import ReceiptsList from "@/components/ReceiptsList";
import PrivacySocialSettings from "@/components/PrivacySocialSettings";
import { isValidRecoveryEmail, saveRecoveryEmail } from "@/lib/recoveryEmail";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";




export type SettingsCategory = "profile" | "account" | "training" | "nutrition" | "appearance" | "stats" | "privacy" | "permissions";

interface SettingsPanelProps {
  userId?: string;
  isAdmin?: boolean;
  isHonorary?: boolean;
  category?: SettingsCategory | "all";
  onStartPlan?: () => void;
  onViewUserPlan?: (targetUserId: string) => void;
}

const SettingsPanel = ({ userId, isAdmin, isHonorary = false, category = "all", onStartPlan, onViewUserPlan }: SettingsPanelProps) => {
  const navigate = useNavigate();
  const [colorTheme, setColorTheme] = useState(getStoredThemeId());
  const { state: cardioVis, set: setCardioVis } = useCardioVisibility();

  // Behörighet läses alltid från den centrala källan (user_roles + is_honorary).
  // Admin/Skapare räknas alltid som hedersmedlem.
  const access = useAccessLevel();
  const honorary = isHonorary || access.isHonorary;




  const [wakeLock, setWakeLockState] = useState(() => isWakeLockEnabled());
  useEffect(() => {
    const unsub = subscribeWakeLock(setWakeLockState);
    return () => { unsub(); };
  }, []);




  const [showChangePassword, setShowChangePassword] = useState(false);
  const [confirmStartPlan, setConfirmStartPlan] = useState(false);
  const [confirmDelete1, setConfirmDelete1] = useState(false);
  const [confirmDelete2, setConfirmDelete2] = useState(false);
  const [fastingOn, setFastingOn] = useState(() => isFastingEnabled());
  const statsSettings = useStatsSettings();
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("gymberget_sound_enabled") !== "false";
  });

  // Biometric unlock
  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(isBiometricEnabled());
  const [bioBusy, setBioBusy] = useState(false);
  useEffect(() => { isBiometricSupported().then(setBioSupported); }, []);

  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailDirty, setEmailDirty] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [emailError, setEmailError] = useState("");

  // Dark/light mode is now handled by the theme system via applyTheme()

  // Wake lock hanteras globalt i src/lib/wakeLock.ts (överlever att panelen stängs)


  useEffect(() => {
    if (!userId) return;
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

  const handleSaveEmail = async () => {
    if (!userId || !email.trim()) return;
    if (!isValidRecoveryEmail(email)) {
      setEmailError("Det ser inte ut som en giltig e-postadress");
      return;
    }
    setEmailError("");
    setEmailSaving(true);
    const result = await saveRecoveryEmail(supabase, userId, email);
    setEmailSaving(false);
    if (result.ok === false) {
      setEmailError(result.error);
      return;
    }
    setEmail(result.email);
    setHasEmail(true);
    setEmailSaved(true);
    setEmailDirty(false);
    setTimeout(() => setEmailSaved(false), 2000);
  };

  const inCategory = (target: SettingsCategory) => category === "all" || category === target;

  return (
    <div className="bg-background border border-border rounded-lg p-4 space-y-4">
      {category === "all" && <h3 className="text-sm font-bold font-sans">⚙️ Inställningar</h3>}

      {/* Theme picker - replaces old dark mode toggle */}
      {userId && inCategory("appearance") && (
        <ThemePicker
          userId={userId}
          isHonorary={honorary}
          currentTheme={colorTheme}
          onThemeChange={setColorTheme}
        />
      )}

      {/* Wake lock toggle */}
      {isWakeLockSupported() && inCategory("training") && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" />
            <span className="text-sm">Håll skärmen vaken</span>
          </div>
          <button
            onClick={() => void setWakeLockEnabled(!wakeLock)}
            className={`relative w-11 h-6 rounded-full transition-colors ${wakeLock ? "bg-primary" : "bg-secondary border border-border"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${wakeLock ? "translate-x-5 bg-primary-foreground" : "translate-x-0 bg-muted-foreground"}`} />
          </button>
        </div>
      )}

      {/* Samlade visningsval för Statistik */}
      {inCategory("stats") && (
      <section className="rounded-2xl border border-border/60 bg-card p-3 space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Statistik</p>
            <p className="text-xs text-muted-foreground">Anpassa vad som visas i statistikvyn</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sektioner</p>
          <div className="flex flex-wrap gap-1.5">
            {STATS_SECTIONS.map((sec) => {
              const on = statsSettings.isVisible(sec.key);
              return (
                <button
                  key={sec.key}
                  type="button"
                  onClick={() => statsSettings.toggle(sec.key)}
                  aria-pressed={on}
                  aria-label={`Visa ${sec.label}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    on
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {on && <Check className="h-3.5 w-3.5 text-primary" />}
                  {sec.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Viktkurvans tidsperiod</p>
          <div className="grid grid-cols-2 gap-1.5">
            {WEIGHT_RANGES.map((x) => (
              <button
                key={x.days}
                type="button"
                onClick={() => statsSettings.setWeightDays(x.days)}
                aria-pressed={statsSettings.weightDays === x.days}
                className={`rounded-xl px-2 py-2 text-xs font-semibold transition-colors ${
                  statsSettings.weightDays === x.days
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Konditionsövningar</p>
          <div className="grid grid-cols-2 gap-1.5">
            {CARDIO_CATEGORIES.map((cat) => {
              const on = cardioVis[cat.key] !== false;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCardioVis(cat.key, !on)}
                  aria-pressed={on}
                  aria-label={`Visa ${cat.label} i statistik`}
                  className={`flex min-w-0 items-center gap-2 rounded-xl border p-2.5 text-left transition-colors ${
                    on
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="text-xl leading-none">{cat.icon}</span>
                  <span className="min-w-0 flex-1 text-xs font-semibold leading-tight">{cat.label}</span>
                  {on && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {inCategory("nutrition") && (<>
      {/* Fasting widget toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-primary" />
          <span className="text-sm">Periodisk fasta i Kost</span>
        </div>
        <button
          onClick={() => {
            const next = !fastingOn;
            setFastingEnabled(next);
            setFastingOn(next);
          }}
          aria-label="Visa periodisk fasta i Kost"
          className={`relative w-11 h-6 rounded-full transition-colors ${fastingOn ? "bg-primary" : "bg-secondary border border-border"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${fastingOn ? "translate-x-5 bg-primary-foreground" : "translate-x-0 bg-muted-foreground"}`} />
        </button>
      </div>

      </>)}

      {inCategory("training") && (<>
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






      </>)}

      {inCategory("account") && (<>
      {/* Biometric unlock toggle */}
      {bioSupported && userId && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-primary" />
            <div>
              <span className="text-sm block">Biometrisk upplåsning</span>
              <span className="text-[10px] text-muted-foreground">Kräv Face ID / fingeravtryck för att öppna appen</span>
            </div>
          </div>
          <button
            disabled={bioBusy}
            onClick={async () => {
              setBioBusy(true);
              try {
                if (bioEnabled) {
                  disableBiometric();
                  setBioEnabled(false);
                } else {
                  const ok = await enableBiometric(userId, "Grim user");
                  setBioEnabled(ok);
                  if (!ok) alert("Kunde inte aktivera biometrisk upplåsning. Kontrollera att enheten stöder det.");
                }
              } finally {
                setBioBusy(false);
              }
            }}
            className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${bioEnabled ? "bg-primary" : "bg-secondary border border-border"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${bioEnabled ? "translate-x-5 bg-primary-foreground" : "translate-x-0 bg-muted-foreground"}`} />
          </button>
        </div>
      )}

      </>)}

      {inCategory("account") && (<>
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
                Hit skickar vi ett tillfälligt lösenord om du glömmer ditt. Vi skickar ingen reklam.
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailDirty(true); setEmailError(""); }}
                placeholder="din@email.com"
                className="w-full bg-secondary text-secondary-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              />
              {emailError && <p className="text-xs text-destructive" role="alert">{emailError}</p>}
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

      </>)}

      {inCategory("privacy") && userId && <PrivacySocialSettings userId={userId} />}

      {inCategory("account") && (<>
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

      </>)}

      {/* Start plan */}
      {userId && inCategory("training") && (
        <div className="border-t border-border pt-2">
          <button
            onClick={() => setConfirmStartPlan(true)}
            className="w-full flex items-center gap-2 py-2 text-sm font-semibold text-primary hover:opacity-80 transition-opacity"
          >
            <Dumbbell className="w-4 h-4" />
            Starta träningsplan
          </button>
        </div>
      )}

      <AlertDialog open={confirmStartPlan} onOpenChange={setConfirmStartPlan}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Starta en träningsplan?</AlertDialogTitle>
            <AlertDialogDescription>Dina nuvarande pass arkiveras under din profil först.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                localStorage.setItem("grim_start_plan_from_settings", "1");
                onStartPlan?.();
              }}
            >Starta plan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave plan */}
      {userId && inCategory("training") && (
        <div className="border-t border-border pt-2">
          <button
            onClick={async () => {
              if (!confirm("Är du säker? Schemat arkiveras under din profil innan det tas bort. Enstaka pass behålls.")) return;
              try {
                const { error } = await (supabase as any).rpc("archive_current_workouts", {
                  p_include_singles: false,
                });
                if (error) throw error;
              } catch (e) {
                console.error("Failed to archive plan:", e);
                toast.error(`Kunde inte arkivera schemat: ${(e as any)?.message || "okänt fel"}`);
                return;
              }
              localStorage.setItem("grim_show_workout_choice", "1");
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

      {/* Delete account */}
      {userId && inCategory("account") && (
        <div className="border-t border-border pt-4">
          <button
            onClick={() => setConfirmDelete1(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-red-700 dark:text-red-400 bg-secondary rounded-full shadow-soft active:scale-[0.97] hover:opacity-90 transition-opacity"
          >
            <Trash2 className="w-4 h-4" />
            Radera konto
          </button>
        </div>
      )}

      <AlertDialog open={confirmDelete1} onOpenChange={setConfirmDelete1}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Radera konto?</AlertDialogTitle>
            <AlertDialogDescription>
              Detta tar bort hela ditt konto och all data (pass, vänner, meddelanden, prenumeration). Åtgärden kan inte ångras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmDelete1(false); setConfirmDelete2(true); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Fortsätt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete2} onOpenChange={setConfirmDelete2}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Är du helt säker?</AlertDialogTitle>
            <AlertDialogDescription>
              Sista chansen att avbryta. Vill du verkligen radera kontot permanent?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Nej, behåll kontot</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmDelete2(false); navigate("/delete-account"); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ja, radera permanent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {isAdmin && userId && inCategory("account") && (
        <Suspense fallback={null}><AdminPanel userId={userId} onViewUserPlan={onViewUserPlan} /></Suspense>
      )}
    </div>
  );
};

export default SettingsPanel;
