import { useState, useEffect, useRef, useCallback } from "react";
import { User, Camera, Loader2, Instagram, Music, Crown, Shield, Ruler, Trash2, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HonoraryBadge from "./HonoraryBadge";
import AvatarCropDialog from "./AvatarCropDialog";
import SettingsSection from "./SettingsSection";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { pickImage } from "@/lib/pickImage";


interface ProfileSectionProps {
  userId: string;
}

const GENDER_OPTIONS = [
  { value: "", label: "Ej angivet" },
  { value: "man", label: "Man" },
  { value: "kvinna", label: "Kvinna" },
  { value: "annat", label: "Annat" },
];

const inputClass =
  "w-full rounded-xl bg-secondary/60 border border-border/60 text-foreground text-sm px-3 py-2.5 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground";

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
  const navigate = useNavigate();
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
  const [spotifyThumb, setSpotifyThumb] = useState<string | null>(null);
  const [fetchingSpotify, setFetchingSpotify] = useState(false);
  const [isHonorary, setIsHonorary] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = useRef(false);
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

  // Trigger auto-save when any field changes (after initial load AND user interaction)
  useEffect(() => {
    if (!loaded || !dirty.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      doSave();
    }, 1000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [age, gender, weightKg, instagram, tiktok, snapchat, spotifyUrl, spotifyName, loaded, doSave]);

  // Save on unmount/visibility change (only if user changed something)
  useEffect(() => {
    if (!loaded) return;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && dirty.current) doSave();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (dirty.current) doSave();
    };
  }, [loaded, doSave]);

  // Auto-fetch Spotify track name + artwork from oEmbed
  useEffect(() => {
    const url = spotifyUrl.trim();
    if (!url || !url.includes("open.spotify.com/track/")) {
      setSpotifyThumb(null);
      return;
    }
    const controller = new AbortController();
    const fetchTrackName = async () => {
      setFetchingSpotify(true);
      try {
        const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (data.thumbnail_url) setSpotifyThumb(data.thumbnail_url);
          if (data.title) {
            dirty.current = true;
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

  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setCropFile(file);
    setCropOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePickAvatar = async () => {
    const picked = await pickImage({ source: "prompt" });
    if (!picked) return;
    if (!picked.file.type.startsWith("image/")) return;
    setCropFile(picked.file);
    setCropOpen(true);
  };


  const handleCropSave = async (blob: Blob) => {
    setUploading(true);
    const filePath = `${userId}/avatar.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, blob, { upsert: true, contentType: "image/jpeg" });
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
    setCropOpen(false);
    setCropFile(null);
  };

  return (
    <div className="space-y-4">
      {/* Profil: foto + medlemskap */}
      <SettingsSection title="Profil" icon={User}>
        <div className="space-y-4">
          {isAdmin ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-primary/15 text-primary">
              <Shield className="w-4 h-4" /> Admin
            </div>
          ) : isHonorary ? (
            <HonoraryBadge size="md" />
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-secondary/60 text-muted-foreground">
              <User className="w-4 h-4" /> Medlem
            </div>
          )}

          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-secondary/60 border border-border/60 overflow-hidden flex items-center justify-center shadow-soft">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profilbild" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
              <button
                onClick={handlePickAvatar}
                disabled={uploading}
                aria-label="Byt profilbild"
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-soft border-2 border-card hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Tryck på kameran för att byta bild · max 2 MB, JPG/PNG
            </p>
          </div>
        </div>
      </SettingsSection>

      {/* Kroppsdata */}
      <SettingsSection title="Kroppsdata" icon={Ruler}>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground block">Ålder</label>
            <input
              type="number"
              inputMode="numeric"
              value={age}
              onChange={(e) => { dirty.current = true; setAge(e.target.value); }}
              placeholder="Ange din ålder"
              min={1}
              max={120}
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground block">Kön</label>
            <select
              value={gender}
              onChange={(e) => { dirty.current = true; setGender(e.target.value); }}
              className={inputClass}
            >
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground block">Vikt (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              value={weightKg}
              onChange={(e) => { dirty.current = true; setWeightKg(e.target.value); }}
              placeholder="Ange din vikt"
              min={30}
              max={300}
              className={inputClass}
            />
            <p className="text-[10px] text-muted-foreground">Används för att beräkna kaloriförbrukning</p>
          </div>
        </div>
      </SettingsSection>

      {/* Sociala medier */}
      <SettingsSection title="Sociala medier" icon={Instagram} defaultOpen={false}>
        <div className="space-y-3">
          {([
            { label: "Instagram", value: instagram, set: setInstagram, icon: <Instagram className="w-4 h-4" /> },
            { label: "TikTok", value: tiktok, set: setTiktok, icon: <Music className="w-4 h-4" /> },
            { label: "Snapchat", value: snapchat, set: setSnapchat, icon: <Camera className="w-4 h-4" /> },
          ] as const).map((f) => (
            <div key={f.label} className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                {f.icon}
              </span>
              <input
                type="text"
                value={f.value}
                onChange={(e) => { dirty.current = true; f.set(e.target.value); }}
                placeholder={`${f.label} – användarnamn`}
                aria-label={f.label}
                className={`${inputClass} pl-10`}
              />
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Anthem */}
      <SettingsSection title="Anthem" icon={Music} defaultOpen={false}>
        <div className="space-y-3">
          {(spotifyThumb || spotifyName) && (
            <div className="flex items-center gap-3 rounded-xl bg-secondary/60 border border-border/60 p-2.5 shadow-soft">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-background flex items-center justify-center shrink-0">
                {spotifyThumb ? (
                  <img src={spotifyThumb} alt={spotifyName || "Albumomslag"} className="w-full h-full object-cover" />
                ) : (
                  <Music className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Din anthem</p>
                <p className="text-sm font-semibold truncate">{spotifyName || "Okänd låt"}</p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground block">Spotify-länk</label>
            <input
              type="url"
              value={spotifyUrl}
              onChange={(e) => { dirty.current = true; setSpotifyUrl(e.target.value); }}
              placeholder="https://open.spotify.com/track/..."
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground block">
              Låtnamn & artist {fetchingSpotify && <Loader2 className="w-3 h-3 inline animate-spin ml-1" />}
            </label>
            <input
              type="text"
              value={spotifyName}
              onChange={(e) => { dirty.current = true; setSpotifyName(e.target.value); }}
              placeholder="Fylls i automatiskt från länken"
              className={inputClass}
            />
          </div>
        </div>
      </SettingsSection>

      <AvatarCropDialog
        open={cropOpen}
        imageFile={cropFile}
        onClose={() => { setCropOpen(false); setCropFile(null); }}
        onSave={handleCropSave}
        saving={uploading}
      />

      {/* Farozon */}
      <div className="pt-2">
        <SettingsSection title="Farozon" icon={AlertTriangle} tone="danger" defaultOpen={false}>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Radering låser kontot direkt och all data tas bort permanent efter 90 dagar.
            </p>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold py-2.5 shadow-soft hover:opacity-90 transition-opacity"
            >
              <Trash2 className="w-4 h-4" /> Radera mitt konto permanent
            </button>
          </div>
        </SettingsSection>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Är du säker?</AlertDialogTitle>
            <AlertDialogDescription>
              Detta går inte att ångra. Du fortsätter till bekräftelsesidan där du skriver "RADERA" för att slutföra raderingen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => navigate("/delete-account")}
              className="bg-destructive text-destructive-foreground hover:opacity-90"
            >
              Fortsätt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProfileSection;
