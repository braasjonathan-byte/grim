import { notifyProfileUpdated } from "@/lib/profileBasics";
import { validateNumber, formatDecimal } from "@/lib/inputValidation";
import { FieldError } from "@/components/ConfirmValueDialog";
import { useAccessLevel } from "@/hooks/useAccessLevel";
import { parseNum } from "@/lib/inputValidation";
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
import { toast } from "sonner";
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
  const [displayName, setDisplayName] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [mainSport, setMainSport] = useState("");
  const [ftp, setFtp] = useState("");
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
  const spotifyUrlEdited = useRef(false);
  const { isHonorary, isAdmin } = useAccessLevel();

  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("age, gender, avatar_url, instagram, tiktok, snapchat, spotify_anthem_url, spotify_anthem_name, weight_kg, height_cm, main_sport, ftp_watt, display_name")
        .eq("user_id", userId)
        .single();

      if (data) {
        setAge(data.age?.toString() || "");
        setGender(data.gender || "");
        const w = (data as any).weight_kg != null ? formatDecimal((data as any).weight_kg) : "";
        savedWeight.current = w;
        setWeightKg(w);
        setAvatarUrl(data.avatar_url || null);
        setDisplayName((data as any).display_name || "");
        setHeightCm((data as any).height_cm != null ? formatDecimal((data as any).height_cm) : "");
        setMainSport((data as any).main_sport || "");
        setFtp((data as any).ftp_watt != null ? String((data as any).ftp_watt) : "");
        setInstagram((data as any).instagram || "");
        setTiktok((data as any).tiktok || "");
        setSnapchat((data as any).snapchat || "");
        setSpotifyUrl((data as any).spotify_anthem_url || "");
        setSpotifyName((data as any).spotify_anthem_name || "");
      }
      setLoaded(true);
    };
    fetchProfile();
  }, [userId]);


  // Kroppsvikt sparas direkt vid blur/Enter (inte fördröjt) och bekräftas med toast.
  const savedWeight = useRef<string>("");
  const weightRef = useRef(weightKg);
  weightRef.current = weightKg;
  const accessToken = useRef<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { accessToken.current = data.session?.access_token ?? null; });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { accessToken.current = session?.access_token ?? null; });
    return () => sub.subscription.unsubscribe();
  }, []);
  const weightDirty = () => weightRef.current.trim() !== savedWeight.current.trim();
  const saveWeight = useCallback(async () => {
    if (!weightDirty()) return;
    const wRes = validateNumber(weightRef.current, "bodyWeightKg");
    if (wRes.error) return; // ogiltiga värden sparas aldrig
    const value = weightRef.current;
    const { error } = await supabase.from("profiles").update({ weight_kg: wRes.value } as any).eq("user_id", userId);
    if (error) { toast.error("Vikten kunde inte sparas."); return; }
    savedWeight.current = value;
    toast.success("Vikt sparad");
    notifyProfileUpdated();
  }, [userId]);
  // Lämnar användaren sidan med osparad vikt: skicka ändringen så att den överlever omladdningen.
  useEffect(() => {
    const flush = () => {
      if (!weightDirty() || !accessToken.current) return;
      const wRes = validateNumber(weightRef.current, "bodyWeightKg");
      if (wRes.error) return;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`;
      try {
        fetch(url, {
          method: "PATCH",
          keepalive: true,
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${accessToken.current}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ weight_kg: wRes.value }),
        });
        savedWeight.current = weightRef.current;
      } catch {}
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      if (weightDirty()) saveWeight();
    };
  }, [userId, saveWeight]);

  // Auto-save profile with debounce (kroppsvikt hanteras separat ovan)
  const doSave = useCallback(async () => {
    const ageRes = validateNumber(age, "ageYears");
    if (ageRes.error) return; // ogiltiga värden sparas aldrig
    const hRes = validateNumber(heightCm, "heightCm");
    if (hRes.error) return;
    const ftpNum = ftp.trim() ? parseInt(ftp, 10) : null;
    if (ftpNum != null && !(ftpNum >= 30 && ftpNum <= 700)) return;
    const url = spotifyUrl.trim();
    const name = spotifyName.trim();
    await supabase
      .from("profiles")
      .update({
        age: ageRes.value,
        height_cm: hRes.value,
        main_sport: mainSport || null,
        ftp_watt: ftpNum,
        display_name: displayName.trim().slice(0, 40) || null,
        gender: gender || null,
        instagram: extractUsername(instagram, "instagram.com") || null,
        tiktok: extractUsername(tiktok, "tiktok.com") || null,
        snapchat: extractUsername(snapchat, "snapchat.com") || null,
        // Tom länk = ingen anthem; namnet följer med bara om det finns en länk.
        spotify_anthem_url: url || null,
        spotify_anthem_name: url ? (name || null) : null,
      } as any)
      .eq("user_id", userId);
    dirty.current = false;
    notifyProfileUpdated();
  }, [heightCm, mainSport, ftp, displayName, age, gender, instagram, tiktok, snapchat, spotifyUrl, spotifyName, userId]);

  // Trigger auto-save when any field changes (after initial load AND user interaction)
  useEffect(() => {
    if (!loaded || !dirty.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      doSave();
    }, 1000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [heightCm, mainSport, ftp, displayName, age, gender, instagram, tiktok, snapchat, spotifyUrl, spotifyName, loaded, doSave]);

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
          // Fyll bara i namnet när användaren själv bytt länk och fältet är tomt –
          // skriv aldrig över "Låt – Artist" som användaren angett.
          if (data.title && spotifyUrlEdited.current) {
            const artist = typeof data.author_name === "string" && data.author_name.trim() ? data.author_name.trim() : "";
            dirty.current = true;
            setSpotifyName((prev) => (prev.trim() ? prev : artist ? `${data.title} – ${artist}` : data.title));
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
            <label className="text-xs text-muted-foreground block">Visningsnamn (valfritt)</label>
            <input type="text" value={displayName} maxLength={40} onChange={(e) => { dirty.current = true; setDisplayName(e.target.value); }} placeholder="T.ex. Jonathan" className={inputClass} />
            <p className="text-[10px] text-muted-foreground">Används i hälsningen på Hem</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground block">Ålder</label>
            <input
              type="text"
              inputMode="numeric"
              value={age}
              onChange={(e) => { dirty.current = true; setAge(e.target.value); }}
              placeholder="Ange din ålder"
              min={1}
              max={120}
              className={inputClass}
            />
            <FieldError error={validateNumber(age, "ageYears").error} />
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
              type="text"
              inputMode="decimal"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              onBlur={() => saveWeight()}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveWeight(); } }}
              placeholder="Ange din vikt"
              min={30}
              max={300}
              className={inputClass}
            />
            <FieldError error={validateNumber(weightKg, "bodyWeightKg").error} />
            <p className="text-[10px] text-muted-foreground">Används för att beräkna kaloriförbrukning</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground block">Längd (cm)</label>
            <input type="text" inputMode="numeric" value={heightCm} onChange={(e) => { dirty.current = true; setHeightCm(e.target.value); }} placeholder="Ange din längd" className={inputClass} />
            <FieldError error={validateNumber(heightCm, "heightCm").error} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground block">Huvudsport</label>
            <select value={mainSport} onChange={(e) => { dirty.current = true; setMainSport(e.target.value); }} className={inputClass}>
              {(["", "Styrketräning", "Löpning", "Cykling", "Simning", "Triathlon", "Kraftlyft", "CrossFit", "Promenad", "Annat"]).map((s) => <option key={s} value={s}>{s || "Ej angivet"}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground block">FTP i watt (valfritt)</label>
            <input type="text" inputMode="numeric" value={ftp} onChange={(e) => { dirty.current = true; setFtp(e.target.value.replace(/\D/g, "")); }} placeholder="T.ex. 220" className={inputClass} />
            {ftp && !(parseInt(ftp, 10) >= 30 && parseInt(ftp, 10) <= 700) && <p className="text-[10px] text-destructive">Ange ett värde mellan 30 och 700 W</p>}
            <p className="text-[10px] text-muted-foreground">Din funktionella tröskeleffekt på cykel</p>
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
          {spotifyUrl.trim() && (spotifyThumb || spotifyName) && (
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
              onChange={(e) => {
                dirty.current = true;
                spotifyUrlEdited.current = true;
                // Ny länk = ny låt: töm det gamla namnet så att det fylls i på nytt.
                if (e.target.value.trim() !== spotifyUrl.trim()) setSpotifyName("");
                setSpotifyUrl(e.target.value);
              }}
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
              placeholder="Låt – Artist"
              className={inputClass}
            />
          </div>

          {(spotifyUrl.trim() || spotifyName.trim()) && (
            <button
              type="button"
              onClick={async () => {
                if (saveTimer.current) clearTimeout(saveTimer.current);
                setSpotifyUrl("");
                setSpotifyName("");
                setSpotifyThumb(null);
                const { error } = await supabase
                  .from("profiles")
                  .update({ spotify_anthem_url: null, spotify_anthem_name: null } as any)
                  .eq("user_id", userId);
                if (error) toast.error("Anthem kunde inte tas bort.");
                else toast.success("Anthem borttagen");
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/40 text-destructive text-sm font-semibold py-2 hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Ta bort anthem
            </button>
          )}
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
