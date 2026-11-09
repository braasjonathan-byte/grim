import { useState, useEffect } from "react";
import { Eye, EyeOff, ArrowLeft, Fingerprint, Mail } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import grimIcon from "@/assets/grim-icon.webp";
import { supabase } from "@/integrations/supabase/client";
import {
  isBiometricEnabled,
  hasBiometricLogin,
  getBiometricLogin,
  saveBiometricLogin,
} from "@/lib/biometric";
import { requestPasswordReset, signInWithPasswordOrTemp } from "@/lib/passwordReset";

interface AuthScreenProps {
  onAuth: () => void;
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
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);

  useEffect(() => {
    setBioAvailable(isBiometricEnabled() && hasBiometricLogin());
  }, []);

  const handleBiometricLogin = async () => {
    setError("");
    setBioLoading(true);
    try {
      const creds = await getBiometricLogin();
      if (!creds) {
        setError("Biometrisk inloggning misslyckades");
        setBioLoading(false);
        return;
      }
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: fakeEmail(creds.nickname),
        password: creds.password,
      });
      if (loginError) {
        setError("Sparade uppgifter ogiltiga – logga in manuellt");
        setBioLoading(false);
        return;
      }
      setBioLoading(false);
      onAuth();
    } catch {
      setError("Något gick fel med biometrin");
      setBioLoading(false);
    }
  };

  // Forgot password state
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Capture referral code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      setReferralCode(ref);
      setIsLogin(false);
      setShowForgot(false);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Sign out on real browser close if "remember me" is off.
  // Do not use visibilitychange here: native Android password managers / OS
  // permission sheets can hide the WebView during login and would otherwise
  // immediately clear the fresh session.
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    const handleUnload = () => {
      if (localStorage.getItem("grim_remember_me") !== "true") {
        void supabase.auth.signOut({ scope: "local" });
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
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
      const result = await signInWithPasswordOrTemp(supabase, { email, nickname: trimmedNick, password });
      if (result.ok === false) {
        setError(result.error);
        setLoading(false);
        return;
      }
      // If biometric is enabled, remember credentials for biometric re-login
      // (never the one-time temporary password)
      if (isBiometricEnabled() && !result.viaTempPassword) {
        saveBiometricLogin(trimmedNick, password);
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

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const value = forgotIdentifier.trim();
    if (value.length < 2) {
      setError("Ange ditt användarnamn eller din e-postadress");
      return;
    }
    setLoading(true);
    const { ok } = await requestPasswordReset(supabase, value);
    setLoading(false);
    if (!ok) {
      setError("Något gick fel. Kontrollera anslutningen och försök igen.");
      return;
    }
    setForgotSent(true);
  };

  const resetForgotState = () => {
    setShowForgot(false);
    setForgotSent(false);
    setForgotIdentifier("");
    setError("");
  };

  if (showForgot) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-8 animate-fade-in">
          <div className="text-center space-y-2">
          <img src={grimIcon} alt="Grim app logo" className="w-20 h-20 mx-auto" width={80} height={80} />
            <h1 className="text-3xl font-black tracking-tight">
              Grim<span className="text-primary">.</span> – Återställ lösenord
            </h1>
            <p className="text-sm text-muted-foreground">Glömt lösenord</p>
          </div>

          {forgotSent ?
          <div className="space-y-4" data-testid="forgot-sent">
              <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold flex items-center gap-2"><Mail className="w-4 h-4" /> Kolla din e-post</p>
                <p className="text-sm text-muted-foreground">
                  Om kontot finns och har en e-postadress kopplad har vi skickat ett tillfälligt lösenord. Det gäller i 24 timmar.
                </p>
                <p className="text-sm text-muted-foreground">
                  Logga in med ditt användarnamn och det tillfälliga lösenordet – sedan får du välja ett nytt. Ditt gamla lösenord fungerar fortfarande tills dess.
                </p>
                <p className="text-xs text-muted-foreground">
                  Inget mejl efter några minuter? Kolla skräpposten, eller mejla grimtraning@gmail.com.
                </p>
              </div>
              <button
              onClick={resetForgotState}
              className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity">
                Tillbaka till inloggning
              </button>
            </div> :
          <>
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label htmlFor="forgot-identifier" className="text-xs text-muted-foreground mb-1 block">Användarnamn eller e-post</label>
                  <input
                  id="forgot-identifier"
                  type="text"
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  placeholder="Användarnamn eller e-post"
                  maxLength={254}
                  autoComplete="username"
                  autoCapitalize="none"
                  className="w-full bg-secondary text-foreground text-lg p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                  autoFocus />
                </div>
                <p className="text-xs text-muted-foreground">
                  Vi skickar ett tillfälligt lösenord till e-postadressen som är kopplad till ditt konto (Inställningar → E-post).
                </p>

                {error && <p className="text-sm text-destructive text-center">{error}</p>}

                <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity">
                  {loading ? "Skickar..." : "Skicka tillfälligt lösenord"}
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
           <img src="/grim-logo.webp" alt="Grim träningsapp logotyp" className="w-60 h-60 mx-auto object-contain" fetchPriority="high" width={240} height={240} />
          <h1 className="text-3xl font-black tracking-tight sr-only">
            {isLogin ? "Logga in på Grim" : "Skapa konto på Grim"}
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
            placeholder="Användarnamn"
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
                aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"}
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

        {isLogin && bioAvailable && (
          <button
            type="button"
            onClick={handleBiometricLogin}
            disabled={bioLoading}
            className="w-full py-3 bg-secondary text-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            <Fingerprint className="w-5 h-5" />
            {bioLoading ? "Verifierar..." : "Logga in med biometri"}
          </button>
        )}

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