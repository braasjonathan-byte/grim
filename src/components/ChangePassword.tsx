import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, X, KeyRound } from "lucide-react";

interface ChangePasswordProps {
  onClose: () => void;
  onChanged?: () => void;
  forced?: boolean;
}

const ChangePassword = ({ onClose, onChanged, forced }: ChangePasswordProps) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Lösenord måste vara minst 8 tecken");
      return;
    }
    if (newPassword === "12345678") {
      setError("Välj ett annat lösenord");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Lösenorden matchar inte");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      // Clear the forced flag in the database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ must_change_password: false })
          .eq("user_id", user.id);
      }
      setSuccess(true);
      setTimeout(() => {
        onChanged?.();
        onClose();
      }, 1500);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl p-6 space-y-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-black">Byt lösenord</h2>
          </div>
          {!forced && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {forced && (
          <p className="text-sm text-destructive font-semibold">
            ⚠️ Du måste byta lösenord innan du kan fortsätta.
          </p>
        )}

        {success ? (
          <p className="text-sm text-success text-center py-4">Lösenordet har ändrats! ✅</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nytt lösenord</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••"
                  maxLength={50}
                  className="w-full bg-secondary text-foreground text-base p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground pr-12"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Bekräfta lösenord</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••"
                maxLength={50}
                className="w-full bg-secondary text-foreground text-base p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {loading ? "Sparar..." : "Byt lösenord"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChangePassword;
