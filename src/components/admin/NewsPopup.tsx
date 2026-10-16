import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNewsPopup } from "@/lib/liveContent";

const SEEN = "grim_news_seen";

/** Nyhet som admin publicerat. Visas en gång per id, i appen och i webbappen. */
export default function NewsPopup() {
  const news = useNewsPopup();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!news) return;
    if (localStorage.getItem(SEEN) === news.id) return;
    setOpen(true);
  }, [news]);

  if (!news) return null;

  const close = () => {
    localStorage.setItem(SEEN, news.id);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {news.title}
          </DialogTitle>
          <DialogDescription>Från Grim</DialogDescription>
        </DialogHeader>
        <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
          {news.items.map((item, i) => <li key={i} className="text-sm">{item}</li>)}
        </ul>
        <button type="button" onClick={close} className="mt-2 w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground">
          Förstått
        </button>
      </DialogContent>
    </Dialog>
  );
}
