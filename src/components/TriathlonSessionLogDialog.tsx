import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { adaptUpcomingSessions } from "@/lib/triathlonAdapter";

interface Session {
  id: string;
  session_date: string;
  discipline: string;
  description: string;
}

interface Props {
  userId: string;
  session: Session;
  onClose: () => void;
  onLogged: () => void;
}

const FELT_OPTIONS = [
  { value: "easy", label: "Lätt" },
  { value: "good", label: "Bra" },
  { value: "hard", label: "Tufft" },
  { value: "too_hard", label: "För hårt" },
] as const;

const PAIN_AREAS = ["Knän", "Smalben", "Höft", "Akilles", "Fötter", "Rygg", "Axlar", "Annat"];

const TriathlonSessionLogDialog = ({ userId, session, onClose, onLogged }: Props) => {
  const [felt, setFelt] = useState<typeof FELT_OPTIONS[number]["value"]>("good");
  const [hadPain, setHadPain] = useState(false);
  const [painArea, setPainArea] = useState<string>("Knän");
  const [painLevel, setPainLevel] = useState(3);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const { error: logErr } = await supabase.from("triathlon_session_logs").insert({
        session_id: session.id,
        user_id: userId,
        felt,
        had_pain: hadPain,
        pain_area: hadPain ? painArea : null,
        pain_level: hadPain ? painLevel : null,
        notes: notes || null,
      });
      if (logErr) throw logErr;

      if (felt === "too_hard" || hadPain) {
        toast("Vi anpassar ditt schema för de kommande dagarna...");
        const modified = await adaptUpcomingSessions({
          userId,
          felt,
          hadPain,
          painArea: hadPain ? painArea : null,
          painLevel: hadPain ? painLevel : null,
          fromDate: session.session_date,
        });
        if (modified > 0) {
          toast.success(`${modified} kommande pass anpassade`);
        }
      } else {
        toast.success("Pass loggat!");
      }
      onLogged();
    } catch (e: any) {
      toast.error(e.message || "Kunde inte spara");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 flex items-center justify-center p-4 pb-24" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-bold">Hur gick passet?</h3>
          <button onClick={onClose} className="text-muted-foreground"><X className="w-5 h-5"/></button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-xs text-muted-foreground">{session.description}</p>

          <div>
            <label className="text-sm font-semibold">Hur kändes det?</label>
            <div className="grid grid-cols-4 gap-1 mt-2">
              {FELT_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setFelt(o.value)}
                  className={`py-2 text-xs font-semibold rounded ${felt === o.value ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary">
            <span className="text-sm font-medium">Smärta eller obehag?</span>
            <Switch checked={hadPain} onCheckedChange={setHadPain} />
          </div>

          {hadPain && (
            <div className="space-y-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
              <div>
                <label className="text-xs font-semibold">Område</label>
                <div className="grid grid-cols-4 gap-1 mt-1">
                  {PAIN_AREAS.map(a => (
                    <button key={a} onClick={() => setPainArea(a)}
                      className={`py-1.5 text-xs rounded ${painArea === a ? "bg-destructive text-destructive-foreground" : "bg-background"}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold">Smärtnivå: <span className="text-destructive">{painLevel}/10</span></label>
                <Slider value={[painLevel]} onValueChange={v => setPainLevel(v[0])} min={1} max={10} step={1} />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold">Anteckningar (valfritt)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full mt-1 p-2 text-sm rounded border border-input bg-background"
              placeholder="Något extra att notera?"
            />
          </div>

        </div>

        <div className="sticky bottom-0 p-4 border-t border-border bg-card">
          <Button onClick={handleSubmit} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : "Spara & klar"}
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default TriathlonSessionLogDialog;
