import { useState, useEffect, useRef, useCallback } from "react";
import { User, Camera, Loader2, Instagram, Music, Crown, Shield } from "lucide-react";
import HonoraryBadge from "./HonoraryBadge";
import { supabase } from "@/integrations/supabase/client";

interface ProfileSectionProps {
  userId: string;
}

const GENDER_OPTIONS = [
  { value: "", label: "Ej angivet" },
  { value: "man", label: "Man" },
  { value: "kvinna", label: "Kvinna" },
  { value: "annat", label: "Annat" },
];

// Extract username from a full URL or plain handle
const extractUsername = (input: string, domain: string): string => {
  const trimmed = input.trim().replace(/^@/, "");
  if (!trimmed) return "";
  try {
    if (trimmed.includes(domain)) {
      const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const path = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "").replace(/^@/, "");
      return path || "";
    }
  } catch { /* not a URL, treat as username */ }
  return trimmed;
};

const ProfileSection = ({ userId }: ProfileSectionProps) => {
  const [age, setAge] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [weightKg, setWeightKg] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [snapchat, setSnapchat] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [spotifyName, setSpotifyName] = useState("");
  const [fetchingSpotify, setFetchingSpotify] = useState(false);
  const [isHonorary, setIsHonorary] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const [{ data }, { data: roleData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("age, gender, avatar_url, instagram, tiktok, snapchat, spotify_anthem_url, spotify_anthem_name, is_honorary, weight_kg")
          .eq("user_id", userId)
          .single(),
        supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      ]);

      if (data) {
        setAge(data.age?.toString() || "");
        setGender(data.gender || "");
        setWeightKg((data as any).weight_kg?.toString() || "");
        setAvatarUrl(data.avatar_url || null);
        setInstagram((data as any).instagram || "");
        setTiktok((data as any).tiktok || "");
        setSnapchat((data as any).snapchat || "");
        setSpotifyUrl((data as any).spotify_anthem_url || "");
        setSpotifyName((data as any).spotify_anthem_name || "");
        setIsHonorary(data.is_honorary ?? false);
      }
      setIsAdmin(!!roleData);
      setLoaded(true);
    };
    fetchProfile();
  }, [userId]);

  // Auto-save profile with debounce
  const doSave = useCallback(async () => {
    const ageNum = age.trim() ? parseInt(age) : null;
    await supabase
      .from("profiles")
      .update({
        age: ageNum && ageNum > 0 && ageNum < 120 ? ageNum : null,
        gender: gender || null,
        weight_kg: weightKg.trim() ? parseFloat(weightKg) : null,
        instagram: extractUsername(instagram, "instagram.com") || null,
        tiktok: extractUsername(tiktok, "tiktok.com") || null,
        snapchat: extractUsername(snapchat, "snapchat.com") || null,
        spotify_anthem_url: spotifyUrl.trim() || null,
        spotify_anthem_name: spotifyName.trim() || null,
      } as any)
      .eq("user_id", userId);
  }, [age, gender, weightKg, instagram, tiktok, snapchat, spotifyUrl, spotifyName, userId]);

  // Trigger auto-save when any field changes (after initial load)
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      doSave();
    }, 1000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [age, gender, weightKg, instagram, tiktok, snapchat, spotifyUrl, spotifyName, loaded, doSave]);

  // Save on unmount/visibility change
  useEffect(() => {
    if (!loaded) return;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") doSave();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      doSave();
    };
  }, [loaded, doSave]);

  // Auto-fetch Spotify track name from oEmbed
  useEffect(() => {
    const url = spotifyUrl.trim();
    if (!url || !url.includes("open.spotify.com/track/")) {
      return;
    }
    const controller = new AbortController();
    const fetchTrackName = async () => {
      setFetchingSpotify(true);
      try {
        const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (data.title) {
            setSpotifyName(data.title);
          }
        }
      } catch {
        // ignore abort / network errors
      } finally {
        setFetchingSpotify(false);
      }
    };
    const timeout = setTimeout(fetchTrackName, 500);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [spotifyUrl]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) return;
    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${userId}/avatar.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });
    if (uploadError) {
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("user_id", userId);
    setAvatarUrl(publicUrl);
    setUploading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Profil</span>
      </div>

      {/* Membership status */}
      {isAdmin ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-primary/15 text-primary">
          <Shield className="w-4 h-4" /> Admin
        </div>
      ) : isHonorary ? (
        <HonoraryBadge size="md" />
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-secondary text-muted-foreground">
          <User className="w-4 h-4" /> Medlem
        </div>
      )}

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-secondary border-2 border-border overflow-hidden flex items-center justify-center">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profilbild"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          <p>Klicka på kameran för att ladda upp.</p>
          <p>Max 2 MB, JPG/PNG.</p>
        </div>
      </div>

      {/* Age */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground block">Ålder</label>
        <input
          type="number"
          inputMode="numeric"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="Ange din ålder"
          min={1}
          max={120}
          className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
        />
      </div>

      {/* Gender */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground block">Kön</label>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary"
        >
          {GENDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Weight */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground block">Vikt (kg)</label>
        <input
          type="number"
          inputMode="decimal"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          placeholder="Ange din vikt"
          min={30}
          max={300}
          className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
        />
        <p className="text-[10px] text-muted-foreground">Används för att beräkna kaloriförbrukning</p>
      </div>

      <div className="pt-2 space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <Instagram className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Sociala medier</span>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground block">Instagram (användarnamn)</label>
          <input
            type="text"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="t.ex. mittnamn"
            className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground block">TikTok (användarnamn)</label>
          <input
            type="text"
            value={tiktok}
            onChange={(e) => setTiktok(e.target.value)}
            placeholder="t.ex. mittnamn"
            className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground block">Snapchat (användarnamn)</label>
          <input
            type="text"
            value={snapchat}
            onChange={(e) => setSnapchat(e.target.value)}
            placeholder="t.ex. mittnamn"
            className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Spotify Anthem */}
      <div className="pt-2 space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <Music className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Anthem</span>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground block">Spotify-länk</label>
          <input
            type="url"
            value={spotifyUrl}
            onChange={(e) => setSpotifyUrl(e.target.value)}
            placeholder="https://open.spotify.com/track/..."
            className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground block">Låtnamn & artist {fetchingSpotify && <Loader2 className="w-3 h-3 inline animate-spin ml-1" />}</label>
          <input
            type="text"
            value={spotifyName}
            onChange={(e) => setSpotifyName(e.target.value)}
            placeholder="Fylls i automatiskt från länken"
            className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>
      </div>
    </div>
  );
};

export default ProfileSection;
