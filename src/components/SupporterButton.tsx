import { useState, useEffect, useCallback } from "react";
import { Crown, Loader2, ExternalLink, Mail, ChevronDown, ChevronUp, Sparkles, MessageCircle } from "lucide-react";
import HonoraryBadge from "./HonoraryBadge";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SupporterButtonProps {
  userId: string;
}

const SupporterButton = ({ userId }: SupporterButtonProps) => {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [isHonorary, setIsHonorary] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const fetchEmail = useCallback(async () => {
    const { data } = await supabase
      .from("user_emails")
      .select("email")
      .eq("user_id", userId)
      .single();
    setRegisteredEmail(data?.email ?? null);
  }, [userId]);

  const checkSubscription = useCallback(async () => {
    try {
      const [subResult, profileResult] = await Promise.all([
        supabase.functions.invoke("check-subscription"),
        supabase.from("profiles").select("is_honorary").eq("user_id", userId).single(),
      ]);
      if (subResult.error) throw subResult.error;
      setSubscribed(subResult.data?.subscribed ?? false);
      setIsHonorary(profileResult.data?.is_honorary ?? false);
    } catch {
      // silently fail
    } finally {
      setChecking(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchEmail();
    checkSubscription();
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [fetchEmail, checkSubscription]);

  const handleSaveEmail = async () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Ange en giltig e-postadress");
      return;
    }
    setSavingEmail(true);
    try {
      const { error } = await supabase
        .from("user_emails")
        .upsert({ user_id: userId, email: trimmed }, { onConflict: "user_id" });
      if (error) throw error;
      setRegisteredEmail(trimmed);
      toast.success("E-postadress sparad!");
    } catch {
      toast.error("Kunde inte spara e-postadressen");
    } finally {
      setSavingEmail(false);
    }
  };

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      if (data?.error === "NO_EMAIL_REGISTERED") {
        toast.error("Registrera din e-postadress först");
        return;
      }
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
      if (data?.error) {
        toast.error("Kunde inte öppna kundportalen. Kontrollera att din e-post matchar den du betalade med.");
        return;
      }
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch {
      toast.error("Kunde inte öppna kundportalen");
    } finally {
      setPortalLoading(false);
    }
  };

  if (checking) return null;

  if (isHonorary) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
        <HonoraryBadge size="md" />
        <p className="text-xs text-muted-foreground">
          Tack för att du supportar Grim! 💪
        </p>
        {registeredEmail && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Mail className="w-3 h-3" /> {registeredEmail}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleManage}
          disabled={portalLoading}
          className="w-full text-xs"
        >
          {portalLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <ExternalLink className="w-3 h-3" />
          )}
          Hantera medlemskap
        </Button>
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold">Bli Supporter</span>
          </div>
          {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-b-xl border border-t-0 border-border bg-card p-4 space-y-3 -mt-2">
          <p className="text-xs text-muted-foreground">
            Stöd Grim med 29 kr/mån och få tillgång till exklusiva funktioner! 💪
          </p>

          <div className="space-y-2 bg-primary/5 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <MessageCircle className="w-3.5 h-3.5 text-primary" />
              Direktsupport via Grim
            </div>
            <p className="text-[11px] text-muted-foreground">
              Som Supporter kan du chatta direkt med Grim i chatten för personlig hjälp och support.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground mt-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Fler funktioner kommer
            </div>
            <p className="text-[11px] text-muted-foreground">
              Vi jobbar på fler exklusiva funktioner för Supporters. Håll utkik!
            </p>
          </div>

          {!registeredEmail ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Registrera din e-postadress först – kvitton skickas hit.
              </p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="din@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="text-sm h-9"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveEmail}
                  disabled={savingEmail}
                  className="shrink-0"
                >
                  {savingEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : "Spara"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="w-3 h-3" /> {registeredEmail}
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
                Bli Premium – 29 kr/mån
              </Button>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default SupporterButton;
