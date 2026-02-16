import { useState, useEffect } from "react";
import { Moon, Sun, Check, Loader2, ShieldQuestion, ChevronDown, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ProfileSection from "@/components/ProfileSection";

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
}

const SettingsPanel = ({ userId }: SettingsPanelProps) => {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  const [profileOpen, setProfileOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  // Security questions state
  const [secQuestions, setSecQuestions] = useState<(number | null)[]>([null, null, null, null]);
  const [secAnswers, setSecAnswers] = useState<string[]>(["", "", "", ""]);
  const [secSaving, setSecSaving] = useState(false);
  const [secSaved, setSecSaved] = useState(false);
  const [secHasExisting, setSecHasExisting] = useState(false);

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

    // Load existing security questions
    supabase
      .rpc("get_my_security_question_indices")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSecHasExisting(true);
          const qs: (number | null)[] = [null, null, null, null];
          (data as { question_index: number }[]).forEach((row, i) => {
            if (i < 4) {
              qs[i] = row.question_index;
            }
          });
          setSecQuestions(qs);
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

    // Hash answers server-side via edge function
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

  const getAvailableQuestions = (slotIndex: number) => {
    const selected = secQuestions.filter((q, i) => i !== slotIndex && q !== null);
    return SECURITY_QUESTIONS.map((q, idx) => ({
      idx,
      text: q,
      disabled: selected.includes(idx),
    }));
  };

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

      {/* Profile dropdown */}
      {userId && (
        <div className="border-t border-border pt-2">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-full flex items-center justify-between py-2"
          >
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Profil</span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`}
            />
          </button>
          {profileOpen && (
            <div className="pb-2">
              <ProfileSection userId={userId} />
            </div>
          )}
        </div>
      )}

      {/* Security questions dropdown */}
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
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform ${securityOpen ? "rotate-180" : ""}`}
            />
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
                  <>
                    <Check className="w-4 h-4" /> Sparade!
                  </>
                ) : (
                  secHasExisting ? "Uppdatera säkerhetsfrågor" : "Spara säkerhetsfrågor"
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;
