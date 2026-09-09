import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AuthScreen from "@/components/AuthScreen";
import { Button } from "@/components/ui/button";

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function oauthApi(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [needsAuth, setNeedsAuth] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    if (!authorizationId) {
      setError("Missing authorization_id");
      return;
    }
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      setNeedsAuth(true);
      return;
    }
    setNeedsAuth(false);
    const { data, error: detailsError } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (detailsError) {
      setError(detailsError.message);
      return;
    }
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) {
      window.location.href = immediate;
      return;
    }
    setDetails(data);
  }, [authorizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(approve: boolean) {
    setBusy(true);
    const api = oauthApi();
    const { data, error: decideError } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (decideError) {
      setBusy(false);
      setError(decideError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Auktoriseringsservern skickade ingen vidarebefordran.");
      return;
    }
    window.location.href = target;
  }

  if (needsAuth) {
    return <AuthScreen onAuth={() => void load()} />;
  }

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-bold">Kunde inte läsa förfrågan</h1>
        <p className="text-muted-foreground text-sm">{error}</p>
        <Button onClick={() => void load()}>Försök igen</Button>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-muted-foreground">Laddar…</p>
      </main>
    );
  }

  const clientName = details.client?.name ?? "en app";

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-4 shadow-lg">
        <h1 className="text-xl font-bold">Anslut {clientName} till Grim</h1>
        <p className="text-sm text-muted-foreground">
          {clientName} får läsa din träningsprofil, dina planerade pass och dina genomförda pass, samt
          klarmarkera pass åt dig.
        </p>
        <div className="flex gap-3 pt-2">
          <Button className="flex-1" disabled={busy} onClick={() => void decide(true)}>
            Godkänn
          </Button>
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => void decide(false)}>
            Neka
          </Button>
        </div>
      </div>
    </main>
  );
}
