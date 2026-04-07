import { useState, useEffect } from "react";
import { Music, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SpotifyWidgetProps {
  userId: string;
}

const SpotifyWidget = ({ userId }: SpotifyWidgetProps) => {
  const [anthemUrl, setAnthemUrl] = useState<string | null>(null);
  const [anthemName, setAnthemName] = useState<string | null>(null);
  const [isHonorary, setIsHonorary] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("spotify_anthem_url, spotify_anthem_name, is_honorary")
        .eq("user_id", userId)
        .single();
      if (data) {
        setAnthemUrl(data.spotify_anthem_url);
        setAnthemName(data.spotify_anthem_name);
        setIsHonorary(data.is_honorary ?? false);
      }
      setLoaded(true);
    };
    fetch();
  }, [userId]);

  if (!loaded || !isHonorary || !anthemUrl) return null;

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

  return (
    <a
      href={deepLink}
      onClick={(e) => {
        // Try deep link first, fallback to web URL
        const timeout = setTimeout(() => {
          window.open(anthemUrl, "_blank");
        }, 500);
        const handleBlur = () => {
          clearTimeout(timeout);
          window.removeEventListener("blur", handleBlur);
        };
        window.addEventListener("blur", handleBlur);
      }}
      className="flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--accent))]/60 border border-border hover:border-primary/40 transition-all group cursor-pointer no-underline"
    >
      <div className="w-9 h-9 rounded-full bg-[#1DB954]/20 flex items-center justify-center flex-shrink-0">
        <Music className="w-4 h-4 text-[#1DB954]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Min anthem
        </p>
        <p className="text-sm font-semibold text-foreground truncate">
          {anthemName || "Spela i Spotify"}
        </p>
      </div>
      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
    </a>
  );
};

export default SpotifyWidget;
