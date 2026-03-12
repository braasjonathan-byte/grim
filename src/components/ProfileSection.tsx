import { useState, useEffect, useRef } from "react";
import { User, Camera, Loader2, Check, Instagram, Music, Crown, Shield } from "lucide-react";
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
      // pathname like /username or /@username
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [snapchat, setSnapchat] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [spotifyName, setSpotifyName] = useState("");
  const [fetchingSpotify, setFetchingSpotify] = useState(false);
  const [isHonorary, setIsHonorary] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const [{ data }, { data: roleData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("age, gender, avatar_url, instagram, tiktok, snapchat, spotify_anthem_url, spotify_anthem_name, is_honorary")
          .eq("user_id", userId)
          .single(),
        supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      ]);

      if (data) {
        setAge(data.age?.toString() || "");
        setGender(data.gender || "");
        setAvatarUrl(data.avatar_url || null);
        setInstagram((data as any).instagram || "");
        setTiktok((data as any).tiktok || "");
        setSnapchat((data as any).snapchat || "");
        setSpotifyUrl((data as any).spotify_anthem_url || "");
        setSpotifyName((data as any).spotify_anthem_name || "");
        setIsHonorary(data.is_honorary ?? false);
      }
      setIsAdmin(!!roleData);
    };
    fetchProfile();
  }, [userId]);

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
            setDirty(true);
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

    // Validate file type
    if (!file.type.startsWith("image/")) return;
    // Limit to 2MB
    if (file.size > 2 * 1024 * 1024) return;

    setUploading(true);

    const fileExt = file.name.split(".").pop();
    const filePath = `${userId}/avatar.${fileExt}`;

    // Upload to storage
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

    // Save to profile
    await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("user_id", userId);

    setAvatarUrl(publicUrl);
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);

    const ageNum = age.trim() ? parseInt(age) : null;
    await supabase
      .from("profiles")
      .update({
        age: ageNum && ageNum > 0 && ageNum < 120 ? ageNum : null,
        gender: gender || null,
        instagram: extractUsername(instagram, "instagram.com") || null,
        tiktok: extractUsername(tiktok, "tiktok.com") || null,
        snapchat: extractUsername(snapchat, "snapchat.com") || null,
        spotify_anthem_url: spotifyUrl.trim() || null,
        spotify_anthem_name: spotifyName.trim() || null,
      } as any)
      .eq("user_id", userId);

    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Profil</span>
      </div>

      {/* Membership status */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${isAdmin ? "bg-primary/15 text-primary" : isHonorary ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground"}`}>
        {isAdmin ? <Shield className="w-4 h-4" /> : isHonorary ? <Crown className="w-4 h-4" /> : <User className="w-4 h-4" />}
        {isAdmin ? "Admin" : isHonorary ? "Hedersmedlem" : "Medlem"}
      </div>

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
          onChange={(e) => {
            setAge(e.target.value);
            setDirty(true);
          }}
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
          onChange={(e) => {
            setGender(e.target.value);
            setDirty(true);
          }}
          className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary"
        >
          {GENDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Social media */}
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
            onChange={(e) => { setInstagram(e.target.value); setDirty(true); }}
            placeholder="t.ex. mittnamn"
            className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground block">TikTok (användarnamn)</label>
          <input
            type="text"
            value={tiktok}
            onChange={(e) => { setTiktok(e.target.value); setDirty(true); }}
            placeholder="t.ex. mittnamn"
            className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground block">Snapchat (användarnamn)</label>
          <input
            type="text"
            value={snapchat}
            onChange={(e) => { setSnapchat(e.target.value); setDirty(true); }}
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
            onChange={(e) => { setSpotifyUrl(e.target.value); setDirty(true); }}
            placeholder="https://open.spotify.com/track/..."
            className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground block">Låtnamn & artist {fetchingSpotify && <Loader2 className="w-3 h-3 inline animate-spin ml-1" />}</label>
          <input
            type="text"
            value={spotifyName}
            onChange={(e) => { setSpotifyName(e.target.value); setDirty(true); }}
            placeholder="Fylls i automatiskt från länken"
            className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Save button */}
      {dirty && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <>
              <Check className="w-4 h-4" /> Sparat!
            </>
          ) : (
            "Spara profil"
          )}
        </button>
      )}
      {saved && !dirty && (
        <p className="text-xs text-center text-success flex items-center justify-center gap-1">
          <Check className="w-3 h-3" /> Sparat!
        </p>
      )}
    </div>
  );
};

export default ProfileSection;
