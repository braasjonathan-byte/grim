import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { clearNewsPopup, saveNewsPopup, useNewsPopup } from "@/lib/liveContent";
import UndoContentButton from "@/components/admin/UndoContentButton";

export default function AdminNews({ userId }: { userId: string }) {
  const current = useNewsPopup();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  const publish = async () => {
    const items = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!title.trim() || !items.length) return toast.error("Rubrik och minst en rad");
    try {
      await saveNewsPopup({ id: String(Date.now()), title: title.trim(), items }, userId);
      setTitle("");
      setText("");
      toast.success("Nyheten visas för alla som inte stängt den");
    } catch (e: any) { toast.error(e?.message || "Kunde inte spara"); }
  };
  const clear = async () => {
    try { await clearNewsPopup(); toast.success("Nyheten är borttagen"); }
    catch (e: any) { toast.error(e?.message || "Kunde inte ta bort"); }
  };

  return (
    <div className="space-y-2 text-sm">
      <p className="text-[11px] text-muted-foreground">En ruta som öppnas en gång för varje användare. En rad per punkt.</p>
      {current && <p className="rounded-xl bg-muted px-3 py-2 text-xs">Aktiv nu: {current.title}</p>}
      <Input value={title} maxLength={80} placeholder="Rubrik" onChange={(e) => setTitle(e.target.value)} />
      <Textarea rows={6} value={text} placeholder={"Första nyheten\nAndra nyheten"} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={publish}>Visa för alla</Button>
        {current && <Button size="sm" variant="outline" onClick={clear}>Ta bort</Button>}
        <UndoContentButton contentKey="news_popup" userId={userId} />
      </div>
    </div>
  );
}
