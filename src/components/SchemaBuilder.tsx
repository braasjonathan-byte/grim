import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Copy, Trash2, ArrowLeft, Save, ChevronDown, ChevronUp, GripVertical } from "lucide-react";

interface SchemaBuilderProps {
  userId: string;
  onDone: () => void;
  onBack: () => void;
}

const DAYS = ["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"];

interface BuilderDay {
  day: string;
  session_name: string;
  details: string;
  tempo: string;
}

interface BuilderWeek {
  weekNumber: number;
  days: BuilderDay[];
  collapsed: boolean;
}

const SchemaBuilder = ({ userId, onDone, onBack }: SchemaBuilderProps) => {
  const [weeks, setWeeks] = useState<BuilderWeek[]>([
    { weekNumber: 1, days: [], collapsed: false },
  ]);
  const [saving, setSaving] = useState(false);
  const [editingDay, setEditingDay] = useState<{ weekIdx: number; dayIdx: number } | null>(null);
  const [showAddDay, setShowAddDay] = useState<number | null>(null);
  const [newDay, setNewDay] = useState<BuilderDay>({ day: "Mån", session_name: "", details: "", tempo: "" });
  const [copySource, setCopySource] = useState<number | null>(null);

  const addWeek = () => {
    const next = weeks.length > 0 ? Math.max(...weeks.map(w => w.weekNumber)) + 1 : 1;
    setWeeks(prev => [...prev, { weekNumber: next, days: [], collapsed: false }]);
  };

  const copyWeek = (sourceIdx: number) => {
    const source = weeks[sourceIdx];
    const next = weeks.length > 0 ? Math.max(...weeks.map(w => w.weekNumber)) + 1 : 1;
    setWeeks(prev => [
      ...prev,
      {
        weekNumber: next,
        days: source.days.map(d => ({ ...d })),
        collapsed: false,
      },
    ]);
  };

  const deleteWeek = (idx: number) => {
    if (weeks.length <= 1) return;
    setWeeks(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleCollapse = (idx: number) => {
    setWeeks(prev => prev.map((w, i) => i === idx ? { ...w, collapsed: !w.collapsed } : w));
  };

  const addDayToWeek = (weekIdx: number) => {
    if (!newDay.session_name.trim()) return;
    setWeeks(prev => prev.map((w, i) => {
      if (i !== weekIdx) return w;
      return { ...w, days: [...w.days, { ...newDay }] };
    }));
    setNewDay({ day: "Mån", session_name: "", details: "", tempo: "" });
    setShowAddDay(null);
  };

  const updateDay = (weekIdx: number, dayIdx: number, field: keyof BuilderDay, value: string) => {
    setWeeks(prev => prev.map((w, wi) => {
      if (wi !== weekIdx) return w;
      return {
        ...w,
        days: w.days.map((d, di) => di === dayIdx ? { ...d, [field]: value } : d),
      };
    }));
  };

  const deleteDay = (weekIdx: number, dayIdx: number) => {
    setWeeks(prev => prev.map((w, wi) => {
      if (wi !== weekIdx) return w;
      return { ...w, days: w.days.filter((_, di) => di !== dayIdx) };
    }));
  };

  const availableDays = (weekIdx: number) => {
    const used = weeks[weekIdx].days.map(d => d.day);
    return DAYS.filter(d => !used.includes(d));
  };

  const totalDays = weeks.reduce((sum, w) => sum + w.days.length, 0);

  const handleSave = async () => {
    if (totalDays === 0) return;
    setSaving(true);

    const rows = weeks.flatMap(w =>
      w.days.map(d => ({
        user_id: userId,
        week: w.weekNumber,
        day: d.day,
        session_name: d.session_name,
        details: d.details,
        tempo: d.tempo,
      }))
    );

    // Also fill rest days for complete weeks
    const allRows = weeks.flatMap(w => {
      const usedDays = w.days.map(d => d.day);
      const restDays = DAYS.filter(d => !usedDays.includes(d)).map(d => ({
        user_id: userId,
        week: w.weekNumber,
        day: d,
        session_name: "Vila",
        details: "",
        tempo: "",
      }));
      return [...rows.filter(r => r.week === w.weekNumber), ...restDays];
    });

    // Deduplicate by week+day
    const unique = new Map<string, typeof allRows[0]>();
    for (const r of allRows) {
      unique.set(`${r.week}-${r.day}`, r);
    }

    const finalRows = Array.from(unique.values());

    for (let i = 0; i < finalRows.length; i += 50) {
      await supabase.from("workout_plans").insert(finalRows.slice(i, i + 50));
    }

    setSaving(false);
    onDone();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-black tracking-tight">Bygg eget schema</h2>
          <p className="text-xs text-muted-foreground">
            {weeks.length} {weeks.length === 1 ? "vecka" : "veckor"} · {totalDays} pass
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || totalDays === 0}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          <Save className="w-4 h-4" />
          {saving ? "Sparar..." : "Spara"}
        </button>
      </div>

      {/* Weeks */}
      {weeks.map((week, weekIdx) => (
        <div key={weekIdx} className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Week header */}
          <div
            className="flex items-center justify-between p-3 bg-secondary/50 cursor-pointer"
            onClick={() => toggleCollapse(weekIdx)}
          >
            <div className="flex items-center gap-2">
              {week.collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
              <span className="font-bold text-sm">Vecka {week.weekNumber}</span>
              <span className="text-xs text-muted-foreground">
                {week.days.length} {week.days.length === 1 ? "pass" : "pass"}
              </span>
            </div>
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => copyWeek(weekIdx)}
                className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                title="Kopiera vecka"
              >
                <Copy className="w-4 h-4" />
              </button>
              {weeks.length > 1 && (
                <button
                  onClick={() => deleteWeek(weekIdx)}
                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                  title="Ta bort vecka"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Week content */}
          {!week.collapsed && (
            <div className="p-3 space-y-2">
              {/* Existing days */}
              {week.days
                .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day))
                .map((day, dayIdx) => {
                  const realDayIdx = week.days.indexOf(day);
                  const isEditing = editingDay?.weekIdx === weekIdx && editingDay?.dayIdx === realDayIdx;

                  return (
                    <div key={`${day.day}-${dayIdx}`} className="bg-secondary/30 border border-border/50 rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-muted-foreground uppercase">{day.day}</span>
                        <div className="flex gap-1.5">
                          {isEditing ? (
                            <button
                              onClick={() => setEditingDay(null)}
                              className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground font-medium"
                            >
                              Klar
                            </button>
                          ) : (
                            <button
                              onClick={() => setEditingDay({ weekIdx, dayIdx: realDayIdx })}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Redigera
                            </button>
                          )}
                          <button
                            onClick={() => deleteDay(weekIdx, realDayIdx)}
                            className="text-xs text-destructive hover:text-destructive/80"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={day.session_name}
                            onChange={e => updateDay(weekIdx, realDayIdx, "session_name", e.target.value)}
                            placeholder="Passnamn (t.ex. Styrka överkropp)"
                            className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                          />
                          <textarea
                            value={day.details}
                            onChange={e => updateDay(weekIdx, realDayIdx, "details", e.target.value)}
                            placeholder="Övningar (t.ex. Bänkpress 5×3 @ RPE 7)"
                            rows={3}
                            className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-none"
                          />
                          <input
                            type="text"
                            value={day.tempo}
                            onChange={e => updateDay(weekIdx, realDayIdx, "tempo", e.target.value)}
                            placeholder="Tempo/RPE (valfritt)"
                            className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                          />
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-sm">{day.session_name || <span className="text-muted-foreground italic">Inget namn</span>}</p>
                          {day.details && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{day.details}</p>}
                          {day.tempo && <p className="text-xs text-muted-foreground font-mono mt-1">{day.tempo}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* Add day form */}
              {showAddDay === weekIdx ? (
                <div className="border border-primary/30 rounded-md p-3 space-y-2 animate-fade-in">
                  <select
                    value={newDay.day}
                    onChange={e => setNewDay(prev => ({ ...prev, day: e.target.value }))}
                    className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none"
                  >
                    {availableDays(weekIdx).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newDay.session_name}
                    onChange={e => setNewDay(prev => ({ ...prev, session_name: e.target.value }))}
                    placeholder="Passnamn"
                    className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                  />
                  <textarea
                    value={newDay.details}
                    onChange={e => setNewDay(prev => ({ ...prev, details: e.target.value }))}
                    placeholder="Övningar"
                    rows={3}
                    className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-none"
                  />
                  <input
                    type="text"
                    value={newDay.tempo}
                    onChange={e => setNewDay(prev => ({ ...prev, tempo: e.target.value }))}
                    placeholder="Tempo/RPE (valfritt)"
                    className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => addDayToWeek(weekIdx)}
                      disabled={!newDay.session_name.trim()}
                      className="flex-1 py-2 bg-primary text-primary-foreground font-semibold rounded-md text-sm disabled:opacity-40"
                    >
                      Lägg till
                    </button>
                    <button
                      onClick={() => { setShowAddDay(null); setNewDay({ day: "Mån", session_name: "", details: "", tempo: "" }); }}
                      className="px-4 py-2 bg-secondary text-muted-foreground rounded-md text-sm"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              ) : (
                availableDays(weekIdx).length > 0 && (
                  <button
                    onClick={() => {
                      const avail = availableDays(weekIdx);
                      setNewDay({ day: avail[0] || "Mån", session_name: "", details: "", tempo: "" });
                      setShowAddDay(weekIdx);
                    }}
                    className="w-full py-2.5 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Lägg till pass
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add week */}
      <button
        onClick={addWeek}
        className="w-full py-3 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" /> Lägg till vecka
      </button>

      {/* Copy week shortcut */}
      {weeks.length > 0 && (
        <div className="bg-secondary/30 border border-border rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">⚡ Snabbkopiera vecka</p>
          <div className="flex flex-wrap gap-2">
            {weeks.map((w, idx) => (
              <button
                key={idx}
                onClick={() => copyWeek(idx)}
                disabled={w.days.length === 0}
                className="flex items-center gap-1 px-3 py-1.5 bg-secondary text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
              >
                <Copy className="w-3 h-3" /> V{w.weekNumber}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom save */}
      {totalDays > 0 && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {saving ? "Sparar schema..." : `Spara schema (${totalDays} pass)`}
        </button>
      )}
    </div>
  );
};

export default SchemaBuilder;
