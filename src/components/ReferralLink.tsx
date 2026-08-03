import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, Copy, Check, QrCode, X, Share2 } from "lucide-react";
import HonoraryBadge from "./HonoraryBadge";
import { QRCodeSVG } from "qrcode.react";

interface ReferralLinkProps {
  userId: string;
}

const ReferralLink = ({ userId }: ReferralLinkProps) => {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isHonorary, setIsHonorary] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("referral_code, is_honorary, nickname")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (data) {
          setReferralCode((data as any).referral_code);
          setIsHonorary((data as any).is_honorary);
          setNickname((data as any).nickname ?? null);
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

  const handleShare = async () => {
    const shareData = {
      title: "Grim",
      text: `Starta din resa med Grim nu\n${referralUrl}`,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        handleCopy();
      }
    } catch {
      // User cancelled share
    }
  };

  return (
    <div className="bg-card shadow-soft rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Link className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold font-sans">Bjud in en vän</h3>
        {isHonorary && <HonoraryBadge size="sm" nickname={nickname} />}
      </div>
      <p className="text-xs text-muted-foreground">
        Dela din personliga länk eller QR-kod. När någon registrerar sig via den blir du hedersmedlem!
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
        <button
          onClick={() => setShowQR(!showQR)}
          className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-foreground text-xs font-semibold hover:opacity-90 transition-opacity border border-border"
          title="Visa QR-kod"
        >
          {showQR ? <X className="w-3.5 h-3.5" /> : <QrCode className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-foreground text-xs font-semibold hover:opacity-90 transition-opacity border border-border"
          title="Dela"
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {showQR && (
        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="bg-white p-4">
            <QRCodeSVG
              value={referralUrl}
              size={200}
              level="M"
              includeMargin={false}
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Skanna QR-koden för att registrera dig via min inbjudan
          </p>
        </div>
      )}
    </div>
  );
};

export default ReferralLink;
