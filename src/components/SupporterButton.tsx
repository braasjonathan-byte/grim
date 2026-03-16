import { useState, useEffect, useCallback } from "react";
import { Crown, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface SupporterButtonProps {
  userId: string;
}

const SupporterButton = ({ userId }: SupporterButtonProps) => {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [isHonorary, setIsHonorary] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const checkSubscription = useCallback(async () => {
    try {
      const [subResult, profileResult] = await Promise.all([
        supabase.functions.invoke("check-subscription"),
        supabase.from("profiles").select("is_honorary").eq("user_id", userId).single(),
      ]);
      if (subResult.error) throw subResult.error;
      setSubscribed(subResult.data?.subscribed ?? false);
      setSubscriptionEnd(subResult.data?.subscription_end ?? null);
      setIsHonorary(profileResult.data?.is_honorary ?? false);
    } catch {
      // silently fail
    } finally {
      setChecking(false);
    }
  }, [userId]);

  useEffect(() => {
    checkSubscription();
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleManage = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch {
      // silently fail
    } finally {
      setPortalLoading(false);
    }
  };

  if (checking) return null;

  if (isHonorary) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" />
          <span className="text-sm font-bold text-primary">Hedersmedlem ⭐</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Tack för att du supportar Grim! 💪
          {subscribed && subscriptionEnd && (
            <> Din prenumeration förnyas{" "}
            {new Date(subscriptionEnd).toLocaleDateString("sv-SE", {
              day: "numeric",
              month: "long",
            })}.</>
          )}
        </p>
        {subscribed && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleManage}
            disabled={portalLoading}
            className="text-xs"
          >
            {portalLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ExternalLink className="w-3 h-3" />
            )}
            Hantera prenumeration
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Crown className="w-5 h-5 text-muted-foreground" />
        <span className="text-sm font-bold">Bli Supporter</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Stöd Grim med 29 kr/mån och hjälp oss bygga vidare! 💪
      </p>
      <Button
        onClick={handleCheckout}
        disabled={loading}
        size="sm"
        className="w-full"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Crown className="w-4 h-4" />
        )}
        Bli Supporter – 29 kr/mån
      </Button>
    </div>
  );
};

export default SupporterButton;
