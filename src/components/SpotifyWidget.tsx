import { useState, useEffect } from "react";
import { Music, ExternalLink, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SpotifyWidgetProps {
  userId: string;
}

const SpotifyWidget = ({ userId }: SpotifyWidgetProps) => {
  const [anthemUrl, setAnthemUrl] = useState<string | null>(null);
  const [anthemName, setAnthemName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("spotify_anthem_url, spotify_anthem_name")
        .eq("user_id", userId)
        .single();
      if (data) {
        setAnthemUrl(data.spotify_anthem_url);
        setAnthemName(data.spotify_anthem_name);
      }
      setLoaded(true);
    };
    fetchProfile();
  }, [userId]);

  if (!loaded || !anthemUrl) return null;
  if (localStorage.getItem("gymberget_spotify_widget") === "false") return null;

  // Convert web URL to deep link: https://open.spotify.com/track/xxx → spotify:track:xxx
  const getDeepLink = (url: string): string => {
    try {
      const match = url.match(/open\.spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)/);
      if (match) {
        return `spotify:${match[1]}:${match[2]}`;
      }
    } catch { /* fallback */ }
    return url;
  };

  const deepLink = getDeepLink(anthemUrl);

  // Extract artist & title if format is "Title - Artist"
  const parts = anthemName?.split(" - ") || [];
  const title = parts[0]?.trim() || "Spela i Spotify";
  const artist = parts.length > 1 ? parts.slice(1).join(" - ").trim() : null;

  return (
    <a
      href={deepLink}
      onClick={() => {
        const timeout = setTimeout(() => {
          window.open(anthemUrl!, "_blank");
        }, 500);
        const handleBlur = () => {
          clearTimeout(timeout);
          window.removeEventListener("blur", handleBlur);
        };
        window.addEventListener("blur", handleBlur);
      }}
      className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#1DB954]/10 to-[#1DB954]/5 border border-[#1DB954]/20 hover:border-[#1DB954]/40 transition-all group cursor-pointer no-underline"
    >
      {/* Play icon */}
      <div className="w-10 h-10 rounded-full bg-[#1DB954] flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition-transform">
        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-[#1DB954] font-bold flex items-center gap-1">
          <Music className="w-3 h-3" />
          Nu spelar
        </p>
        <p className="text-sm font-semibold text-foreground truncate">{title}</p>
        {artist && (
          <p className="text-xs text-muted-foreground truncate">{artist}</p>
        )}
      </div>

      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-[#1DB954] transition-colors flex-shrink-0" />
    </a>
  );
};

export default SpotifyWidget;
