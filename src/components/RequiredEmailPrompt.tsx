import { useState } from "react";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RECOVERY_EMAIL_MAX_LENGTH, RECOVERY_EMAIL_WHY, saveRecoveryEmail, validateRecoveryEmail } from "@/lib/recoveryEmail";

interface RequiredEmailPromptProps {
  userId: string;
  onSaved: (email: string) => void;
  onSignedOut?: () => void;
}

/** Blocking screen: every signed-in user must have a recovery e-mail saved. */
const RequiredEmailPrompt = ({ userId, onSaved, onSignedOut }: RequiredEmailPromptProps) => {
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const validation = validateRecoveryEmail(email, confirm);
    if (validation) {
      setError(validation);
      return;
    }
    setLoading(true);
    const result = await saveRecoveryEmail(supabase, userId, email);
    setLoading(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => onSaved(result.email), 1200);
  };

  const inputClass =
    "w-full bg-secondary text-secondary-foreground text-base p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground";

  return (
    <div
      className="fixed inset-0 z-[9999] bg-background flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="required-email-title"
      data-testid="required-email">
      <div className="w-full max-w-sm card-soft p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          <h2 id="required-email-title" className="text-lg font-black">Lägg till din e-post</h2>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-foreground">{RECOVERY_EMAIL_WHY}</p>
          <p className="text-xs text-muted-foreground">
            Vi använder den bara för ditt konto, aldrig för reklam, och den syns inte för andra. Du kan ändra den under Inställningar.
          </p>
        </div>

        {saved ? (
          <p className="text-sm text-success text-center py-4">E-postadressen är sparad ✅</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="required-email" className="text-xs text-muted-foreground mb-1 block">E-postadress</label>
              <input
                id="required-email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="din@email.se"
                maxLength={RECOVERY_EMAIL_MAX_LENGTH}
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={inputClass}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="required-email-confirm" className="text-xs text-muted-foreground mb-1 block">Skriv e-postadressen igen</label>
              <input
                id="required-email-confirm"
                type="email"
                inputMode="email"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onPaste={(e) => e.preventDefault()}
                placeholder="din@email.se"
                maxLength={RECOVERY_EMAIL_MAX_LENGTH}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={inputClass}
              />
            </div>

            {error && <p className="text-sm text-destructive text-center" role="alert">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity">
              {loading ? "Sparar..." : "Spara och fortsätt"}
            </button>
            <button
              type="button"
              onClick={() => { void supabase.auth.signOut().finally(() => onSignedOut?.()); }}
              disabled={loading}
              className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Logga ut
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default RequiredEmailPrompt;
