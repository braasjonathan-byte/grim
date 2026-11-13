import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ChevronUp } from "lucide-react";

export default function ConversationHistoryStatus({ loading, loadingOlder, error, hasOlder, empty, reload, loadOlder }: { loading: boolean; loadingOlder: boolean; error: boolean; hasOlder: boolean; empty: boolean; reload: () => void; loadOlder: () => void }) {
  return <div className="space-y-2 text-center">
    {error && <div role="alert" className="space-y-2"><p className="text-sm text-muted-foreground">Meddelandena kunde inte hämtas.</p><Button variant="outline" onClick={hasOlder ? loadOlder : reload}><RefreshCw /> Försök igen</Button></div>}
    {loading ? <Loader2 className="mx-auto animate-spin text-muted-foreground" aria-label="Laddar meddelanden" /> : !error && empty ? <p className="py-6 text-sm text-muted-foreground">Inga meddelanden ännu.</p> : null}
    {hasOlder && <Button variant="ghost" disabled={loadingOlder} onClick={loadOlder}>{loadingOlder ? <Loader2 className="animate-spin" /> : <ChevronUp />} Äldre meddelanden</Button>}
  </div>;
}