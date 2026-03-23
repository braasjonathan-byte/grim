import { useState, useEffect, useCallback } from "react";
import { Crown, Loader2, ExternalLink, Mail, XCircle } from "lucide-react";
import HonoraryBadge from "./HonoraryBadge";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  const [cancelLoading, setCancelLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

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
      setSubscriptionEnd(subResult.data?.subscription_end ?? null);
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

  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription");
      if (error) throw error;
      if (data?.success) {
        const endDate = data.cancel_at
          ? new Date(data.cancel_at).toLocaleDateString("sv-SE", { day: "numeric", month: "long" })
          : "";
        toast.success(`Prenumerationen avslutas ${endDate}`);
        checkSubscription();
      } else {
        toast.error(data?.error || "Kunde inte avbryta prenumerationen");
      }
    } catch {
      toast.error("Kunde inte avbryta prenumerationen");
    } finally {
      setCancelLoading(false);
    }
  };

  if (checking) return null;

  if (isHonorary) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
        <HonoraryBadge size="md" />
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
        {registeredEmail && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Mail className="w-3 h-3" /> {registeredEmail}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManage}
            disabled={portalLoading}
            className="flex-1 text-xs"
          >
            {portalLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ExternalLink className="w-3 h-3" />
            )}
            Hantera medlemskap
          </Button>
          {subscribed && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={cancelLoading}
                >
                  {cancelLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <XCircle className="w-3 h-3" />
                  )}
                  Avsluta
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Avsluta prenumeration?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Din prenumeration avslutas vid nästa förnyelsedatum
                    {subscriptionEnd && (
                      <> ({new Date(subscriptionEnd).toLocaleDateString("sv-SE", { day: "numeric", month: "long" })})</>
                    )}
                    . Du behåller supporter-status till dess.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Behåll</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Avsluta prenumeration
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
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
            Bli Supporter – 29 kr/mån
          </Button>
        </>
      )}
    </div>
  );
};

export default SupporterButton;
