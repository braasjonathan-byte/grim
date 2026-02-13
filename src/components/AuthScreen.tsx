import { useState } from "react";
import { Dumbbell, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AuthScreenProps {
  onAuth: () => void;
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
        password,
      });
      if (loginError) {
        setError("Fel användarnamn eller lösenord");
        setLoading(false);
        return;
      }
    } else {
      const { error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nickname: trimmedNick },
        },
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResetMessage("");
    setResetMessage("");
    setLoading(true);

    const trimmed = forgotNickname.trim();
    if (trimmed.length < 2) {
      setError("Ange ditt användarnamn");
      setLoading(false);
      return;
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke("reset-password", {
        body: { nickname: trimmed },
      });

      if (fnError) {
        setError("Något gick fel. Försök igen.");
        setLoading(false);
        return;
      }

      setResetMessage(data.message || "Om kontot finns och har en e-post skickas ett nytt lösenord dit.");
    } catch {
      setError("Något gick fel. Försök igen.");
    }

    setLoading(false);
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

          {resetMessage ? (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  ✉️ {resetMessage}
                </p>
                <p className="text-xs text-muted-foreground">
                  Kolla din inkorg och logga in med det nya lösenordet. Byt sedan lösenord i inställningarna.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowForgot(false);
                  setResetMessage("");
                  setForgotNickname("");
                }}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity"
              >
                Tillbaka till inloggning
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Användarnamn</label>
                  <input
                    type="text"
                    value={forgotNickname}
                    onChange={(e) => setForgotNickname(e.target.value)}
                    placeholder="Ditt användarnamn"
                    maxLength={20}
                    className="w-full bg-secondary text-foreground text-lg p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Du behöver ha lagt till en e-postadress i inställningarna för att kunna återställa ditt lösenord.
                </p>

                {error && <p className="text-sm text-destructive text-center">{error}</p>}
                {resetMessage && <p className="text-sm text-muted-foreground text-center">{resetMessage}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  {loading ? "Laddar..." : "Återställ lösenord"}
                </button>
              </form>

              <button
                onClick={() => {
                  setShowForgot(false);
                  setError("");
                  setResetMessage("");
                }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Tillbaka till inloggning
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <Dumbbell className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-3xl font-black tracking-tight">
            TRÄNING<span className="text-primary">.</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLogin ? "Logga in" : "Skapa konto"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Användarnamn</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Ditt namn"
              maxLength={20}
              className="w-full bg-secondary text-foreground text-lg p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              autoFocus
            />
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
                className="w-full bg-secondary text-foreground text-lg p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {loading ? "Laddar..." : isLogin ? "Logga in" : "Skapa konto"}
          </button>
        </form>

        {isLogin && (
          <button
            onClick={() => {
              setShowForgot(true);
              setError("");
            }}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Glömt lösenord?
          </button>
        )}

        <button
          onClick={() => {
            setIsLogin(!isLogin);
            setError("");
          }}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {isLogin ? "Har du inget konto? Skapa ett" : "Har du redan konto? Logga in"}
        </button>
      </div>
    </div>
  );
};

export default AuthScreen;
