import { useState, useEffect } from "react";
import { Moon, Sun, Mail, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const THEME_KEY = "gymberget_theme";

interface SettingsPanelProps {
  userId?: string;
}

const SettingsPanel = ({ userId }: SettingsPanelProps) => {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored) return stored === "dark";
    }
    return false;
  });

  const [email, setEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (data?.email) {
          setEmail(data.email);
          setSavedEmail(data.email);
        }
      });
  }, [userId]);

  const handleSaveEmail = async () => {
    if (!userId) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;

    setEmailLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ email: trimmed })
      .eq("user_id", userId);

    if (!error) {
      setSavedEmail(trimmed);
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2000);
    }
    setEmailLoading(false);
  };

  const emailChanged = email.trim().toLowerCase() !== savedEmail;

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
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
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${
              dark ? "translate-x-5 bg-primary-foreground" : "translate-x-0 bg-muted-foreground"
            }`}
          />
        </button>
      </div>

      {/* Email for password recovery */}
      {userId && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            <span className="text-sm">E-post för lösenordsåterställning</span>
          </div>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="din@email.se"
              maxLength={100}
              className="flex-1 bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
            />
            <button
              onClick={handleSaveEmail}
              disabled={!emailChanged || emailLoading}
              className="px-3 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center gap-1"
            >
              {emailLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : emailSaved ? (
                <Check className="w-4 h-4" />
              ) : (
                "Spara"
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Används för att återställa ditt lösenord om du glömmer det.
          </p>
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;
