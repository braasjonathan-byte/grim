import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, Copy, Check, Crown } from "lucide-react";

interface ReferralLinkProps {
  userId: string;
}

const ReferralLink = ({ userId }: ReferralLinkProps) => {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isHonorary, setIsHonorary] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("referral_code, is_honorary")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (data) {
          setReferralCode((data as any).referral_code);
          setIsHonorary((data as any).is_honorary);
        }
      });
  }, [userId]);

  if (!referralCode) return null;

  const baseUrl = window.location.origin;
  const referralUrl = `${baseUrl}?ref=${referralCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = referralUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Link className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold">Bjud in en vän</h3>
        {isHonorary && (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/20 text-warning">
            <Crown className="w-3 h-3" /> Hedersmedlem
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Dela din personliga länk. När någon registrerar sig via den blir du hedersmedlem!
      </p>
      <div className="flex gap-2">
        <div className="flex-1 bg-secondary text-foreground text-xs p-2.5 rounded-lg font-mono truncate select-all">
          {referralUrl}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Kopierad!" : "Kopiera"}
        </button>
      </div>
    </div>
  );
};

export default ReferralLink;
