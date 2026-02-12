import { useState } from "react";
import { Dumbbell, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AuthScreenProps {
  onAuth: () => void;
}

const AuthScreen = ({ onAuth }: AuthScreenProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    if (password.length < 4) {
      setError("Lösenord måste vara minst 4 tecken");
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
      // Check if nickname is taken
      const { data: existing } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("nickname", trimmedNick)
        .maybeSingle();

      if (existing) {
        setError("Namnet är redan taget");
        setLoading(false);
        return;
      }

      const { error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nickname: trimmedNick },
        },
      });
      if (signupError) {
        if (signupError.message.includes("already registered")) {
          setError("Namnet är redan taget");
        } else {
          setError(signupError.message);
        }
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    onAuth();
  };

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
            <label className="text-xs text-muted-foreground mb-1 block">
              Användarnamn
            </label>
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
            <label className="text-xs text-muted-foreground mb-1 block">
              Lösenord
            </label>
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
