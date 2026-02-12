import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Save, Search, X } from "lucide-react";
import { exerciseLibrary, muscleGroups } from "@/data/exerciseLibrary";

interface PlanEditorProps {
  userId: string;
}

const DAYS = ["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"];

interface PlanDay {
  id?: string;
  week: number;
  day: string;
  session_name: string;
  details: string;
  tempo: string;
}

const PlanEditor = ({ userId }: PlanEditorProps) => {
  const [plans, setPlans] = useState<PlanDay[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [weeks, setWeeks] = useState<number[]>([1]);
  const [editing, setEditing] = useState<string | null>(null);
  const [showExercises, setShowExercises] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddDay, setShowAddDay] = useState(false);
  const [newDay, setNewDay] = useState<PlanDay>({ week: 1, day: "Mån", session_name: "", details: "", tempo: "" });

  useEffect(() => {
    fetchPlans();
  }, [userId]);

  const fetchPlans = async () => {
    const { data } = await supabase
      .from("workout_plans")
      .select("*")
      .eq("user_id", userId)
      .order("week")
      .order("day");

    if (data) {
      setPlans(data.map((d) => ({ ...d, tempo: d.tempo || "" })));
      const wks = [...new Set(data.map((d) => d.week))].sort((a, b) => a - b);
      if (wks.length > 0) setWeeks(wks);
    }
  };

  const weekDays = plans
    .filter((p) => p.week === selectedWeek)
    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));

  const savePlan = async (plan: PlanDay) => {
    setSaving(true);
    await supabase.from("workout_plans").upsert(
      {
        id: plan.id || undefined,
        user_id: userId,
        week: plan.week,
        day: plan.day,
        session_name: plan.session_name,
        details: plan.details,
        tempo: plan.tempo,
      },
      { onConflict: "user_id,week,day" }
    );
    setSaving(false);
    setEditing(null);
    fetchPlans();
  };

  const deletePlan = async (plan: PlanDay) => {
    if (plan.id) {
      await supabase.from("workout_plans").delete().eq("id", plan.id);
      fetchPlans();
    }
  };

  const addDay = async () => {
    const plan = { ...newDay, week: selectedWeek };
    await savePlan(plan);
    setShowAddDay(false);
    setNewDay({ week: selectedWeek, day: "Mån", session_name: "", details: "", tempo: "" });
  };

  const addWeek = () => {
    const nextWeek = weeks.length > 0 ? Math.max(...weeks) + 1 : 1;
    setWeeks([...weeks, nextWeek]);
    setSelectedWeek(nextWeek);
  };

  const updateField = (idx: number, field: keyof PlanDay, value: string | number) => {
    setPlans((prev) => {
      const updated = [...prev];
      const planIdx = prev.findIndex(
        (p) => p.week === selectedWeek && p.day === weekDays[idx].day
      );
      if (planIdx >= 0) {
        updated[planIdx] = { ...updated[planIdx], [field]: value };
      }
      return updated;
    });
  };

  const filteredExercises = exerciseLibrary.filter((e) => {
    const matchesSearch = !exerciseSearch || e.name.toLowerCase().includes(exerciseSearch.toLowerCase());
    const matchesMuscle = !selectedMuscle || e.muscleGroup === selectedMuscle;
    return matchesSearch && matchesMuscle;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">Träningsschema</h2>
        <button
          onClick={() => setShowExercises(!showExercises)}
          className="text-xs px-3 py-1.5 rounded-md bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          {showExercises ? "Dölj övningar" : "📚 Övningsbibliotek"}
        </button>
      </div>

      {/* Exercise library panel */}
      {showExercises && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Övningsbibliotek</h3>
            <button onClick={() => setShowExercises(false)} className="text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              placeholder="Sök övning..."
              className="w-full bg-secondary text-foreground text-sm pl-9 pr-3 py-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedMuscle(null)}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${!selectedMuscle ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
            >
              Alla
            </button>
            {muscleGroups.map((mg) => (
              <button
                key={mg}
                onClick={() => setSelectedMuscle(mg === selectedMuscle ? null : mg)}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${selectedMuscle === mg ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
              >
                {mg}
              </button>
            ))}
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredExercises.map((e) => (
              <div key={e.name} className="flex items-center justify-between p-2 bg-secondary rounded-md text-sm">
                <span>{e.name}</span>
                <span className="text-xs text-muted-foreground">{e.muscleGroup}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {weeks.map((w) => (
          <button
            key={w}
            onClick={() => setSelectedWeek(w)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
              selectedWeek === w
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-muted"
            }`}
          >
            V{w}
          </button>
        ))}
        <button
          onClick={addWeek}
          className="flex-shrink-0 px-3 py-1.5 rounded-md text-sm bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Days */}
      <div className="space-y-2">
        {weekDays.map((plan, idx) => {
          const isEditing = editing === `${plan.week}-${plan.day}`;
          return (
            <div key={`${plan.week}-${plan.day}`} className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground uppercase">{plan.day}</span>
                <div className="flex gap-2">
                  {isEditing ? (
                    <button
                      onClick={() => savePlan(plan)}
                      disabled={saving}
                      className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground"
                    >
                      <Save className="w-3 h-3" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditing(`${plan.week}-${plan.day}`)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Redigera
                    </button>
                  )}
                  <button onClick={() => deletePlan(plan)} className="text-xs text-destructive hover:text-destructive/80">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={plan.session_name}
                    onChange={(e) => updateField(idx, "session_name", e.target.value)}
                    placeholder="Passnamn (t.ex. Styrka överkropp)"
                    className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                  />
                  <textarea
                    value={plan.details}
                    onChange={(e) => updateField(idx, "details", e.target.value)}
                    placeholder="Detaljer (t.ex. Bänk 5×3 @ RPE 7; Rodd 3×8)"
                    rows={3}
                    className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-none"
                  />
                  <input
                    type="text"
                    value={plan.tempo}
                    onChange={(e) => updateField(idx, "tempo", e.target.value)}
                    placeholder="Tempo/RPE (t.ex. 5:40–5:35)"
                    className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                  />
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-sm">{plan.session_name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{plan.details}</p>
                  {plan.tempo && <p className="text-xs text-muted-foreground font-mono mt-1">{plan.tempo}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add day */}
      {showAddDay ? (
        <div className="bg-card border border-primary/30 rounded-lg p-4 space-y-3 animate-fade-in">
          <h3 className="text-sm font-semibold">Lägg till dag</h3>
          <select
            value={newDay.day}
            onChange={(e) => setNewDay({ ...newDay, day: e.target.value })}
            className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none"
          >
            {DAYS.filter((d) => !weekDays.some((wd) => wd.day === d)).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <input
            type="text"
            value={newDay.session_name}
            onChange={(e) => setNewDay({ ...newDay, session_name: e.target.value })}
            placeholder="Passnamn"
            className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          />
          <textarea
            value={newDay.details}
            onChange={(e) => setNewDay({ ...newDay, details: e.target.value })}
            placeholder="Detaljer"
            rows={3}
            className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-none"
          />
          <input
            type="text"
            value={newDay.tempo}
            onChange={(e) => setNewDay({ ...newDay, tempo: e.target.value })}
            placeholder="Tempo/RPE"
            className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          />
          <div className="flex gap-2">
            <button onClick={addDay} className="flex-1 py-2 bg-primary text-primary-foreground font-semibold rounded-md text-sm">
              Spara
            </button>
            <button onClick={() => setShowAddDay(false)} className="px-4 py-2 bg-secondary text-muted-foreground rounded-md text-sm">
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddDay(true)}
          className="w-full py-3 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Lägg till dag
        </button>
      )}
    </div>
  );
};

export default PlanEditor;
