import { useState, useEffect } from "react";
import { Moon, Sun, Mail, Check, Loader2, ShieldQuestion } from "lucide-react";
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
      const stored = localStorage.getItem(THEME_KEY);
      if (stored) return stored === "dark";
    }
    return false;
  });

  const [email, setEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

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
    supabase
      .from("user_emails")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.email) {
          setEmail(data.email);
          setSavedEmail(data.email);
        }
      });

    // Load existing security questions (we store question_index which maps to SECURITY_QUESTIONS)
    supabase
      .from("security_answers")
      .select("question_index, answer_hash")
      .eq("user_id", userId)
      .order("question_index", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSecHasExisting(true);
          // We can see which question indices are stored, but not the plaintext answers
          const qs: (number | null)[] = [null, null, null, null];
          data.forEach((row, i) => {
            if (i < 4) {
              // answer_hash stores "questionIdx:hash", parse questionIdx
              const parts = row.answer_hash.split(":");
              qs[i] = parseInt(parts[0]) || row.question_index;
            }
          });
          setSecQuestions(qs);
        }
      });
  }, [userId]);

  const handleSaveEmail = async () => {
    if (!userId) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;

    setEmailLoading(true);
    const { error } = await supabase
      .from("user_emails")
      .upsert({ user_id: userId, email: trimmed }, { onConflict: "user_id" });

    if (!error) {
      setSavedEmail(trimmed);
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2000);
    }
    setEmailLoading(false);
  };

  const handleSaveSecurityQuestions = async () => {
    if (!userId) return;

    // Validate all 4 are filled
    for (let i = 0; i < 4; i++) {
      if (secQuestions[i] === null || !secAnswers[i].trim()) return;
    }

    // Check no duplicate questions
    const qSet = new Set(secQuestions);
    if (qSet.size < 4) return;

    setSecSaving(true);

    // Delete existing answers
    await supabase.from("security_answers").delete().eq("user_id", userId);

    // Insert new answers (store as "questionIndex:lowercased_answer" for verification)
    const rows = secQuestions.map((qIdx, i) => ({
      user_id: userId,
      question_index: i,
      answer_hash: `${qIdx}:${secAnswers[i].trim().toLowerCase()}`,
    }));

    const { error } = await supabase.from("security_answers").insert(rows);

    if (!error) {
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

  const emailChanged = email.trim().toLowerCase() !== savedEmail;

  // Get available questions for a given slot (exclude already selected)
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

      {/* Profile section */}
      {userId && (
        <div className="pb-2 border-b border-border">
          <ProfileSection userId={userId} />
        </div>
      )}

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
            Används för att skicka nytt lösenord om du glömmer det.
          </p>
        </div>
      )}

      {/* Security questions */}
      {userId && (
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <ShieldQuestion className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Säkerhetsfrågor</span>
            {secHasExisting && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Sparade</span>
            )}
          </div>
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
  );
};

export default SettingsPanel;
