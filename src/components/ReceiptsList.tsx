import { useState, useEffect } from "react";
import { Receipt, Loader2, ExternalLink, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ReceiptEntry {
  id: string;
  amount: number;
  currency: string;
  date: number;
  description: string;
  receipt_url: string | null;
  pdf_url: string | null;
}

const ReceiptsList = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState<ReceiptEntry[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!open || fetched) return;
    setLoading(true);
    supabase.functions
      .invoke("list-receipts")
      .then(({ data, error }) => {
        if (!error && data) {
          setReceipts(data.receipts ?? []);
          setEmail(data.email ?? null);
        }
        setFetched(true);
      })
      .finally(() => setLoading(false));
  }, [open, fetched]);

  return (
    <div className="border-t border-border pt-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2"
      >
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Kvitton</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-3 pt-1 animate-fade-in">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : receipts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Inga kvitton hittades.
            </p>
          ) : (
            <>
              {email && (
                <p className="text-xs text-muted-foreground">
                  Kopplad e-post: <span className="font-medium text-foreground">{email}</span>
                </p>
              )}
              <div className="space-y-2">
                {receipts.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.date * 1000).toLocaleDateString("sv-SE", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}{" "}
                        ·{" "}
                        {(r.amount / 100).toLocaleString("sv-SE", {
                          style: "currency",
                          currency: r.currency.toUpperCase(),
                        })}
                      </p>
                    </div>
                    {r.receipt_url && (
                      <a
                        href={r.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-md text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ReceiptsList;
