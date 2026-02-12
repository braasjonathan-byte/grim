import { useState } from "react";
import { Lock, Dumbbell } from "lucide-react";
import type { Profile } from "@/data/workoutData";
import { supabase } from "@/integrations/supabase/client";

interface PinScreenProps {
  onUnlock: (profile: Profile) => void;
}

const PinScreen = ({ onUnlock }: PinScreenProps) => {
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleProfileSelect = async (profile: Profile) => {
    setSelectedProfile(profile);
    setPin("");
    setError("");
    setLoading(true);

    // Check if PIN exists for this profile
    const { data } = await supabase
      .from("profile_pins")
      .select("pin_hash")
      .eq("profile", profile)
      .maybeSingle();

    if (!data) {
      setIsSettingPin(true);
    } else {
      setIsSettingPin(false);
    }
    setLoading(false);
  };

  const simpleHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString();
  };

  const handleSubmit = async () => {
    if (!selectedProfile || pin.length < 4) {
      setError("PIN måste vara minst 4 siffror");
      return;
    }

    setLoading(true);
    setError("");

    if (isSettingPin) {
      if (pin !== confirmPin) {
        setError("PIN-koderna matchar inte");
        setLoading(false);
        return;
      }
      const hash = simpleHash(pin);
      const { error: insertError } = await supabase
        .from("profile_pins")
        .insert({ profile: selectedProfile, pin_hash: hash });

      if (insertError) {
        setError("Kunde inte spara PIN");
        setLoading(false);
        return;
      }
      localStorage.setItem(`pin-${selectedProfile}`, "unlocked");
      onUnlock(selectedProfile);
    } else {
      const { data } = await supabase
        .from("profile_pins")
        .select("pin_hash")
        .eq("profile", selectedProfile)
        .single();

      if (data && data.pin_hash === simpleHash(pin)) {
        localStorage.setItem(`pin-${selectedProfile}`, "unlocked");
        onUnlock(selectedProfile);
      } else {
        setError("Fel PIN-kod");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="text-center space-y-2">
          <Dumbbell className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-3xl font-black tracking-tight">
            TRÄNING<span className="text-primary">.</span>
          </h1>
          <p className="text-sm text-muted-foreground">Välj profil för att börja</p>
        </div>

        {/* Profile selection */}
        <div className="grid grid-cols-2 gap-3">
          {(["J", "W"] as Profile[]).map((p) => (
            <button
              key={p}
              onClick={() => handleProfileSelect(p)}
              className={`p-6 rounded-xl border-2 text-center transition-all ${
                selectedProfile === p
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              <span className="text-3xl font-black">{p}</span>
            </button>
          ))}
        </div>

        {/* PIN entry */}
        {selectedProfile && !loading && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center">
              <Lock className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {isSettingPin ? "Skapa en PIN-kod (minst 4 siffror)" : "Ange din PIN-kod"}
              </p>
            </div>

            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              maxLength={8}
              className="w-full text-center text-2xl tracking-[0.5em] bg-secondary text-foreground py-4 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground placeholder:tracking-[0.3em]"
              autoFocus
            />

            {isSettingPin && (
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                placeholder="Bekräfta PIN"
                maxLength={8}
                className="w-full text-center text-2xl tracking-[0.5em] bg-secondary text-foreground py-4 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground placeholder:tracking-[0.1em] placeholder:text-base"
              />
            )}

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={pin.length < 4}
              className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {isSettingPin ? "Skapa PIN" : "Logga in"}
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center text-muted-foreground text-sm">Laddar...</div>
        )}
      </div>
    </div>
  );
};

export default PinScreen;
