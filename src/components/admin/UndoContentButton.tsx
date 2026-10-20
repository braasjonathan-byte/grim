import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { undoContent } from "@/lib/contentHistory";

export default function UndoContentButton({ contentKey, userId, onDone }: { contentKey: string; userId?: string; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const ok = await undoContent(contentKey, userId);
          if (!ok) toast("Inget att ångra");
          else {
            toast.success("Ångrade senaste ändringen");
            onDone?.();
          }
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : "Kunde inte ångra");
        } finally {
          setBusy(false);
        }
      }}
    >
      Ångra senaste
    </Button>
  );
}
