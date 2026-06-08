import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";

const DeleteAccount = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate("/", { replace: true });
        return;
      }
      setEmail(data.user.email ?? null);
      setChecking(false);
    })();
  }, [navigate]);

  const handleDelete = async () => {
    if (confirm.trim().toUpperCase() !== "RADERA") {
      toast.error('Skriv "RADERA" för att bekräfta');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      await supabase.auth.signOut();
      toast.success("Ditt konto har raderats");
      navigate("/", { replace: true });
    } catch (e) {
      toast.error("Kunde inte radera kontot: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="max-w-md mx-auto space-y-6 pt-8">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-6 h-6" />
          <h1 className="text-xl font-bold">Radera ditt konto</h1>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Du är på väg att radera ditt konto <strong className="text-foreground">{email}</strong>.
          </p>

          <div className="rounded-md border border-border bg-secondary p-3 space-y-2">
            <p className="font-semibold text-foreground">Så här fungerar raderingen</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-foreground">Direkt:</strong> du loggas ut från alla enheter och kontot låses. Du kan inte längre logga in eller använda appen.
              </li>
              <li>
                <strong className="text-foreground">Inom 90 dagar:</strong> din data (pass, planer, kommentarer, vänner, prenumeration, meddelanden) sparas i låst läge. Kontakta supporten under denna period om du ångrar dig och vill återställa kontot.
              </li>
              <li>
                <strong className="text-foreground">Efter 90 dagar:</strong> kontot och all tillhörande data raderas permanent och kan <strong>inte</strong> återskapas.
              </li>
            </ul>
          </div>

          <p className="text-xs">
            Obs! Har du en aktiv prenumeration bör du säga upp den separat innan du fortsätter, så att du inte debiteras under väntetiden.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground block">
            Skriv <strong>RADERA</strong> för att bekräfta
          </label>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="RADERA"
            autoCapitalize="characters"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
            className="w-full"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Radera mitt konto permanent"}
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)} disabled={loading}>
            Avbryt
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccount;
