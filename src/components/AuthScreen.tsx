import { useState, useEffect } from "react";
import { Eye, EyeOff, ArrowLeft, ShieldQuestion } from "lucide-react";
import grimIcon from "@/assets/grim-icon.png";
import { supabase } from "@/integrations/supabase/client";

interface AuthScreenProps {
  onAuth: () => void;
}

interface SecurityQuestion {
  index: number;
  question: string;
}

const AuthScreen = ({ onAuth }: AuthScreenProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showForgot, setShowForgot] = useState(false);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem("grim_remember_me") === "true");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [forgotNickname, setForgotNickname] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [forgotStep, setForgotStep] = useState<"nickname" | "questions" | "new-password" | "done">("nickname");
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([]);
  const [securityAnswers, setSecurityAnswers] = useState<string[]>(["", "", "", ""]);
  const [hasEmail, setHasEmail] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Capture referral code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      setReferralCode(ref);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Sign out on tab/browser close if "remember me" is off
  useEffect(() => {
    const handleUnload = () => {
      if (localStorage.getItem("grim_remember_me") !== "true") {
        navigator.sendBeacon && supabase.auth.signOut();
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  const fakeEmail = (nick: string) => `${nick.toLowerCase().trim()}@trainapp.local`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const trimmedNick = nickname.trim();
    if (trimmedNick.length < 2) {
      setError("Namn måste vara minst 2 tecken");
      setLoading(false);
      return;
    }
    if (password.length < 8) {
      setError("Lösenord måste vara minst 8 tecken");
      setLoading(false);
      return;
    }

    const email = fakeEmail(trimmedNick);

    if (isLogin) {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (loginError) {
        setError("Fel användarnamn eller lösenord");
        setLoading(false);
        return;
      }
    } else {
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nickname: trimmedNick }
        }
      });
      if (signupError) {
        setError("Registrering misslyckades. Försök med ett annat namn.");
        setLoading(false);
        return;
      }
      // Process referral code if present
      if (referralCode && signupData?.user) {
        // Small delay to ensure profile is created by trigger
        setTimeout(async () => {
          await supabase.rpc("process_referral", { referral_code_input: referralCode });
        }, 1000);
      }
    }

    setLoading(false);
    onAuth();
  };

  // Step 1: Look up user and get questions
  const handleLookupUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const trimmed = forgotNickname.trim();
    if (trimmed.length < 2) {
      setError("Ange ditt användarnamn");
      setLoading(false);
      return;
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke("reset-password", {
        body: { nickname: trimmed, action: "get-questions" }
      });

      if (fnError || !data?.success) {
        setError("Kontot hittades inte eller har inga återställningsalternativ.");
        setLoading(false);
        return;
      }

      if (data.hasQuestions) {
        setSecurityQuestions(data.questions);
        setSecurityAnswers(data.questions.map(() => ""));
        setForgotStep("questions");
      } else if (data.hasEmail) {
        setHasEmail(true);
        setForgotStep("new-password");
      } else {
        setError("Inga säkerhetsfrågor eller e-post konfigurerade för detta konto.");
      }
    } catch {
      setError("Något gick fel. Försök igen.");
    }

    setLoading(false);
  };

  // Step 2: Verify security answers -> go to new password step
  const handleVerifyAnswers = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (securityAnswers.some((a) => !a.trim())) {
      setError("Fyll i alla svar");
      return;
    }

    setForgotStep("new-password");
  };

  // Step 3: Set new password (with answers or email)
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (newPassword.trim().length < 8) {
      setError("Lösenord måste vara minst 8 tecken");
      setLoading(false);
      return;
    }

    try {
      const action = hasEmail ? "email-reset" : "verify-answers";
      const bodyPayload: Record<string, unknown> = {
        nickname: forgotNickname.trim(),
        action,
        newPassword: newPassword.trim()
      };

      if (!hasEmail) {
        bodyPayload.answers = securityAnswers.map((a) => a.trim());
      }

      const { data, error: fnError } = await supabase.functions.invoke("reset-password", {
        body: bodyPayload
      });

      if (fnError) {
        setError("Något gick fel. Försök igen.");
        setLoading(false);
        return;
      }

      if (data?.success) {
        setResetMessage(data.message);
        setForgotStep("done");
      } else {
        setError(data?.error || "Något gick fel. Försök igen.");
      }
    } catch {
      setError("Något gick fel. Försök igen.");
    }

    setLoading(false);
  };

  const resetForgotState = () => {
    setShowForgot(false);
    setForgotStep("nickname");
    setForgotNickname("");
    setSecurityQuestions([]);
    setSecurityAnswers(["", "", "", ""]);
    setResetMessage("");
    setHasEmail(false);
    setNewPassword("");
    setError("");
  };

  if (showForgot) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-8 animate-fade-in">
          <div className="text-center space-y-2">
          <img src={grimIcon} alt="Grim" className="w-20 h-20 mx-auto" />
            <h1 className="text-3xl font-black tracking-tight">
              Grim<span className="text-primary">.</span>
            </h1>
            <p className="text-sm text-muted-foreground">Återställ lösenord</p>
          </div>

          {/* Step: Done */}
          {forgotStep === "done" &&
          <div className="space-y-4">
              <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  ✅ {resetMessage}
                </p>
              </div>
              <button
              onClick={resetForgotState}
              className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity">

                Tillbaka till inloggning
              </button>
            </div>
          }

          {/* Step: Set new password */}
          {forgotStep === "new-password" &&
          <>
              <form onSubmit={handleSetNewPassword} className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Välj nytt lösenord</label>
                  <div className="relative">
                    <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minst 8 tecken"
                    maxLength={50}
                    className="w-full bg-secondary text-foreground text-lg p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground pr-12"
                    autoFocus />

                    <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-3.5 text-muted-foreground">

                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-sm text-destructive text-center">{error}</p>}

                <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity">

                  {loading ? "Sparar..." : "Byt lösenord"}
                </button>
              </form>

              <button
              onClick={resetForgotState}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1">

                <ArrowLeft className="w-4 h-4" /> Avbryt
              </button>
            </>
          }

          {/* Step: Answer security questions */}
          {forgotStep === "questions" &&
          <>
              <form onSubmit={handleVerifyAnswers} className="space-y-4">
                <div className="flex items-center gap-2 justify-center text-muted-foreground">
                  <ShieldQuestion className="w-5 h-5 text-primary" />
                  <span className="text-sm font-semibold">Svara på dina säkerhetsfrågor</span>
                </div>

                {securityQuestions.map((q, i) =>
              <div key={q.index} className="space-y-1">
                    <label className="text-xs text-muted-foreground block">{q.question}</label>
                    <input
                  type="text"
                  value={securityAnswers[i]}
                  onChange={(e) => {
                    const newAnswers = [...securityAnswers];
                    newAnswers[i] = e.target.value;
                    setSecurityAnswers(newAnswers);
                  }}
                  placeholder="Ditt svar..."
                  maxLength={100}
                  className="w-full bg-secondary text-foreground text-sm p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                  autoFocus={i === 0} />

                  </div>
              )}

                {error && <p className="text-sm text-destructive text-center">{error}</p>}

                <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity">

                  {loading ? "Verifierar..." : "Fortsätt"}
                </button>
              </form>

              <button
              onClick={resetForgotState}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1">

                <ArrowLeft className="w-4 h-4" /> Avbryt
              </button>
            </>
          }

          {/* Step: Enter nickname */}
          {forgotStep === "nickname" &&
          <>
              <form onSubmit={handleLookupUser} className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Användarnamn</label>
                  <input
                  type="text"
                  value={forgotNickname}
                  onChange={(e) => setForgotNickname(e.target.value)}
                  placeholder="Ditt användarnamn"
                  maxLength={20}
                  className="w-full bg-secondary text-foreground text-lg p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                  autoFocus />

                </div>
                <p className="text-xs text-muted-foreground">
                  Ange ditt användarnamn för att återställa lösenordet via säkerhetsfrågor eller e-post.
                </p>

                {error && <p className="text-sm text-destructive text-center">{error}</p>}

                <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity">

                  {loading ? "Laddar..." : "Fortsätt"}
                </button>
              </form>

              <button
              onClick={resetForgotState}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1">

                <ArrowLeft className="w-4 h-4" /> Tillbaka till inloggning
              </button>
            </>
          }
        </div>
      </div>);

  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        <div className="text-center space-y-2 border-none">
           <img src={grimIcon} alt="Grim" className="w-60 h-60 mx-auto" />
          <h1 className="text-3xl font-black tracking-tight">
          </h1>
          <p className="text-xs text-muted-foreground italic">
            lift heavier than runners, run faster than lifters
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {isLogin ? "Logga in" : "Skapa konto"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Användarnamn</label>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
            placeholder="Ditt namn"
            maxLength={20}
            className="w-full bg-secondary text-foreground text-lg p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
            autoFocus />

          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Lösenord</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                maxLength={50}
                className="w-full bg-secondary text-foreground text-lg p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground pr-12" />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-muted-foreground">

                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {isLogin && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => {
                  setRememberMe(e.target.checked);
                  localStorage.setItem("grim_remember_me", String(e.target.checked));
                }}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <span className="text-xs text-muted-foreground">Håll mig inloggad</span>
            </label>
          )}

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity">

            {loading ? "Laddar..." : isLogin ? "Logga in" : "Skapa konto"}
          </button>
        </form>

        {isLogin &&
        <button
          onClick={() => {
            setShowForgot(true);
            setError("");
          }}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">

            Glömt lösenord?
          </button>
        }

        <button
          onClick={() => {
            setIsLogin(!isLogin);
            setError("");
          }}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors">

          {isLogin ? "Har du inget konto? Skapa ett" : "Har du redan konto? Logga in"}
        </button>
      </div>
    </div>);

};

export default AuthScreen;