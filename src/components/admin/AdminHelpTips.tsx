import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { helpCategories } from "@/data/helpTopics";
import { resetHelpTips, saveHelpTips, useHelpCategories, useLiveContentReady } from "@/lib/liveContent";
import UndoContentButton from "@/components/admin/UndoContentButton";

export default function AdminHelpTips({ userId }: { userId: string }) {
  const live = useHelpCategories();
  const ready = useLiveContentReady();
  const [title, setTitle] = useState(helpCategories[0]?.title ?? "");
  const [text, setText] = useState("");

  useEffect(() => {
    if (!ready) return;
    const cat = live.find((c) => c.title === title) ?? live[0];
    if (!cat) return;
    setTitle(cat.title);
    setText(cat.tips.join("\n"));
  }, [ready, title, live]);

  const save = async () => {
    const tips = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!tips.length) return toast.error("Minst ett tips");
    try {
      await saveHelpTips(title, tips, userId);
      toast.success("Hjälptexten är uppdaterad för alla");
    } catch (e: any) { toast.error(e?.message || "Kunde inte spara"); }
  };
  const reset = async () => {
    try { await resetHelpTips(); toast.success("Alla hjälptexter är återställda"); }
    catch (e: any) { toast.error(e?.message || "Kunde inte återställa"); }
  };

  const sel = "w-full rounded-xl border border-input bg-background px-2 py-2 text-sm";
  return (
    <div className="space-y-2 text-sm">
      <p className="text-[11px] text-muted-foreground">En rad per tips. Syns under Hjälp & tips, även i webbappen.</p>
      <select className={sel} value={title} onChange={(e) => setTitle(e.target.value)}>
        {helpCategories.map((c) => <option key={c.title} value={c.title}>{c.title}</option>)}
      </select>
      <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save}>Spara ämnet</Button>
        <Button size="sm" variant="outline" onClick={reset}>Återställ alla</Button>
        <UndoContentButton contentKey="help_tips" userId={userId} />
      </div>
    </div>
  );
}
