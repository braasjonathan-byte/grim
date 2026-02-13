import { useState } from "react";
import { Dumbbell, Eye, EyeOff, ArrowLeft, ShieldQuestion } from "lucide-react";
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [forgotNickname, setForgotNickname] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [forgotStep, setForgotStep] = useState<"nickname" | "questions" | "done">("nickname");
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([]);
  const [securityAnswers, setSecurityAnswers] = useState<string[]>(["", "", "", ""]);
  const [tempPassword, setTempPassword] = useState("");
  const [hasEmail, setHasEmail] = useState(false);

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
        // Normal login failed - try temp password flow
        try {
          const { data: tempData } = await supabase.functions.invoke("reset-password", {
            body: { nickname: trimmedNick, action: "temp-login", tempPassword: password }
          });
          if (tempData?.success) {
            // Temp password was valid, real password is now updated - wait briefly for propagation then retry login
            await new Promise((resolve) => setTimeout(resolve, 500));
            const { error: retryError } = await supabase.auth.signInWithPassword({
              email,
              password
            });
            if (!retryError) {
              setLoading(false);
              onAuth();
              return;
            }
          }
        } catch {

          // Ignore temp login errors, fall through to error message
        }setError("Fel användarnamn eller lösenord");
        setLoading(false);
        return;
      }
    } else {
      const { error: signupError } = await supabase.auth.signUp({
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
        // Trigger email reset
        const { data: emailData, error: emailError } = await supabase.functions.invoke("reset-password", {
          body: { nickname: trimmed, action: "email-reset" }
        });
        if (emailError || !emailData?.success) {
          setError(emailData?.error || "Kunde inte skicka e-post.");
        } else {
          setResetMessage(emailData.message);
          setForgotStep("done");
        }
      } else {
        setError("Inga säkerhetsfrågor eller e-post konfigurerade för detta konto.");
      }
    } catch {
      setError("Något gick fel. Försök igen.");
    }

    setLoading(false);
  };

  // Step 2: Verify security answers
  const handleVerifyAnswers = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (securityAnswers.some((a) => !a.trim())) {
      setError("Fyll i alla svar");
      setLoading(false);
      return;
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke("reset-password", {
        body: {
          nickname: forgotNickname.trim(),
          action: "verify-answers",
          answers: securityAnswers.map((a) => a.trim())
        }
      });

      if (fnError) {
        setError("Något gick fel. Försök igen.");
        setLoading(false);
        return;
      }

      if (data?.success && data?.tempPassword) {
        setTempPassword(data.tempPassword);
        setResetMessage(data.message);
        setForgotStep("done");
      } else {
        setError(data?.error || "Felaktiga svar. Försök igen.");
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
    setTempPassword("");
    setResetMessage("");
    setHasEmail(false);
    setError("");
  };

  if (showForgot) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-8 animate-fade-in">
          <div className="text-center space-y-2">
            <Dumbbell className="w-12 h-12 text-primary mx-auto" />
            <h1 className="text-3xl font-black tracking-tight">
              TRÄNING<span className="text-primary">.</span>
            </h1>
            <p className="text-sm text-muted-foreground">Återställ lösenord</p>
          </div>

          {/* Step: Done */}
          {forgotStep === "done" &&
          <div className="space-y-4">
              <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                {tempPassword ?
              <>
                    <p className="text-sm text-muted-foreground">
                      ✅ {resetMessage}
                    </p>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Nytt tillfälligt lösenord</label>
                      <div className="bg-secondary rounded-lg p-3 font-mono text-lg text-primary select-all text-center tracking-wider">
                        {tempPassword}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ⚠️ Kopiera lösenordet och logga in. Byt sedan lösenord i inställningarna.
                    </p>
                  </> :

              <>
                    <p className="text-sm text-muted-foreground">
                      ✉️ {resetMessage}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Kolla din inkorg och logga in med det nya lösenordet.
                    </p>
                  </>
              }
              </div>
              <button
              onClick={resetForgotState}
              className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity">

                Tillbaka till inloggning
              </button>
            </div>
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

                  {loading ? "Verifierar..." : "Verifiera & återställ"}
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
        <div className="text-center space-y-2">
          <Dumbbell className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-3xl font-black tracking-tight">Grim.
            <span className="text-primary">

            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLogin ? "Logga in" : "Skapa konto"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Användarnamn</label>
            <input type="text" value={nickname}
              onChange={(e) => setNickname(e.target.value)}
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

          {error &&
          <p className="text-sm text-destructive text-center">{error}</p>
          }

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity">

            {loading ? "Laddar..." : isLogin ? "Logga in" : "Skapa konto"}
          </button>
        </form>

        {isLogin &&
        <div className="space-y-3">
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
              <p className="text-xs text-primary font-semibold">
                🔑 Nytt temporärt lösenord: <span className="font-mono tracking-wider">12345678</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Använd detta vid första inloggningen – du kommer att uppmanas byta lösenord.
              </p>
            </div>
            <button
            onClick={() => {
              setShowForgot(true);
              setError("");
            }}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">

              Glömt lösenord?
            </button>
          </div>
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