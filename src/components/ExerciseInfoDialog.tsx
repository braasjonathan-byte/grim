import { useState, useEffect } from "react";
import { X, Info, Loader2, Pencil, Save, RotateCcw, Sparkles, Flag, Check, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ExerciseHistoryDialog from "@/components/ExerciseHistoryDialog";
import { toast } from "sonner";

interface ExerciseInfoDialogProps {
  exerciseName: string;
  onClose: () => void;
  isAdmin?: boolean;
  initialEditMode?: boolean;
  onCategoryChanged?: () => void;
}

interface ExerciseData {
  gifUrl: string | null;
  imageUrls?: string[];
  name: string;
  instructions: string[];
  targetMuscles: string[];
  equipments: string[];
  isCardio?: boolean;
  hasCustomInstructions?: boolean;
  aiGenerated?: boolean;
  creatorId?: string | null;
  isReported?: boolean;
}

const ExerciseInfoDialog = ({ exerciseName, onClose, isAdmin = false, initialEditMode = false, onCategoryChanged }: ExerciseInfoDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExerciseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<string>("styrka");
  const [savingCategory, setSavingCategory] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setAuthUserId(user?.id || null));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const shouldOpenEditor = initialEditMode && isAdmin;

      try {
        const { data: result, error: fnError } = await supabase.functions.invoke("exercise-gif", {
          body: { exerciseName },
        });
        if (fnError) throw fnError;

        if (result?.isCardio || result?.gifUrl || (result?.instructions && result.instructions.length > 0) || result?.creatorId || result?.isReported) {
          setData(result);
          if (shouldOpenEditor) {
            setEditText((result.instructions || []).join("\n"));
            setEditing(true);
          }
        } else {
          if (shouldOpenEditor) {
            setData({ gifUrl: null, name: exerciseName, instructions: [], targetMuscles: [], equipments: [] });
            setEditText("");
            setEditing(true);
          } else {
            setError("Ingen demonstration hittades för denna övning.");
          }
        }
      } catch (e) {
        if (shouldOpenEditor) {
          setData({ gifUrl: null, name: exerciseName, instructions: [], targetMuscles: [], equipments: [] });
          setEditText("");
          setEditing(true);
        } else {
          setError("Kunde inte hämta övningsinformation.");
        }
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    setError(null);
    setData(null);
    setEditText("");
    setEditing(false);
    setShowReport(false);
    setReportReason("");
    fetchData();
  }, [exerciseName, initialEditMode, isAdmin]);

  useEffect(() => {
    const fetchCategory = async () => {
      const { data: custom } = await supabase.from("custom_exercises").select("category").eq("name", exerciseName).maybeSingle();
      if (custom) {
        setCurrentCategory(custom.category);
      } else {
        const { exerciseLibrary } = await import("@/data/exerciseLibrary");
        const found = exerciseLibrary.find(e => e.name.toLowerCase() === exerciseName.toLowerCase());
        setCurrentCategory(found?.category || "styrka");
      }
    };
    fetchCategory();
  }, [exerciseName]);

  const saveCategory = async (newCategory: string) => {
    setSavingCategory(true);
    setCurrentCategory(newCategory);
    try {
      const { data: existing } = await supabase.from("custom_exercises").select("id").eq("name", exerciseName).maybeSingle();
      if (existing) {
        await supabase.from("custom_exercises").update({ category: newCategory }).eq("id", existing.id);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("custom_exercises").insert({ name: exerciseName, category: newCategory, muscle_group: "Helkropp", created_by: user.id });
        }
      }
      onCategoryChanged?.();
    } catch (e) {
      console.error("Failed to save category:", e);
    } finally {
      setSavingCategory(false);
    }
  };

  const isCreator = !!(data?.creatorId && authUserId && data.creatorId === authUserId);
  const canEditDescription = isAdmin || isCreator;
  const isUnreviewedAi = !!(data?.aiGenerated && !data?.hasCustomInstructions);

  const startEditing = () => {
    const lines = data?.instructions || [];
    setEditText(lines.join("\n"));
    setEditing(true);
  };

  const saveInstructions = async () => {
    setSaving(true);
    const instructions = editText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    try {
      const { error: fnError } = await supabase.functions.invoke("exercise-gif", {
        body: { exerciseName, action: "save_instructions", instructions },
      });
      if (fnError) throw fnError;
      setData(prev => prev ? { ...prev, instructions, hasCustomInstructions: true, aiGenerated: false, isReported: false } : prev);
      setEditing(false);
      toast.success("Beskrivningen har sparats");
    } catch (e) {
      console.error("Failed to save instructions:", e);
      toast.error("Kunde inte spara beskrivningen");
    } finally {
      setSaving(false);
    }
  };

  const approveAi = async () => {
    if (!data?.instructions?.length) return;
    setSaving(true);
    try {
      const { error: fnError } = await supabase.functions.invoke("exercise-gif", {
        body: { exerciseName, action: "save_instructions", instructions: data.instructions },
      });
      if (fnError) throw fnError;
      setData(prev => prev ? { ...prev, hasCustomInstructions: true, aiGenerated: false, isReported: false } : prev);
      toast.success("Beskrivningen är godkänd");
    } catch (e) {
      console.error(e);
      toast.error("Kunde inte godkänna beskrivningen");
    } finally {
      setSaving(false);
    }
  };

  const submitReport = async () => {
    setReporting(true);
    try {
      const { error: fnError } = await supabase.functions.invoke("exercise-gif", {
        body: { exerciseName, action: "report_description", reason: reportReason.trim() || null },
      });
      if (fnError) throw fnError;
      setData(prev => prev ? { ...prev, instructions: [], aiGenerated: false, isReported: true } : prev);
      setShowReport(false);
      setReportReason("");
      toast.success("Rapporterad till admin. Ingen beskrivning visas tills den granskats.");
    } catch (e) {
      console.error(e);
      toast.error("Kunde inte skicka rapporten");
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-t-2xl overflow-hidden animate-fade-in max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Info className="w-4 h-4 text-primary flex-shrink-0" />
            <h3 className="font-bold text-sm truncate">{exerciseName}</h3>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {authUserId && (
              <button
                onClick={() => setShowHistory(true)}
                className="p-1.5 text-muted-foreground hover:text-primary"
                title="Visa historik"
                aria-label="Visa historik"
              >
                <History className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {showHistory && authUserId && (
          <ExerciseHistoryDialog
            exerciseName={exerciseName}
            userId={authUserId}
            onClose={() => setShowHistory(false)}
          />
        )}

        {isAdmin && (
          <div className="px-4 pb-2 flex items-center gap-2 border-b border-border">
            <span className="text-xs text-muted-foreground">Kategori:</span>
            <select
              value={currentCategory}
              onChange={e => saveCategory(e.target.value)}
              disabled={savingCategory}
              className="bg-secondary text-foreground text-xs p-1.5 rounded-lg border-none outline-none disabled:opacity-50"
            >
              <option value="styrka">Styrka</option>
              <option value="kondition">Kondition</option>
              <option value="rörlighet">Rörlighet</option>
              <option value="core">Core</option>
            </select>
            {savingCategory && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
          </div>
        )}

        <div className="overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          )}

          {error && !data && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">{error}</p>
              {isAdmin && (
                <button
                  onClick={() => {
                    setError(null);
                    setData({ gifUrl: null, name: exerciseName, instructions: [], targetMuscles: [], equipments: [] });
                    setEditText("");
                    setEditing(true);
                  }}
                  className="text-xs text-primary font-semibold flex items-center gap-1 mx-auto"
                >
                  <Pencil className="w-3 h-3" /> Skriv instruktioner
                </button>
              )}
            </div>
          )}

          {data && (
            <>
              {data.isCardio && !data.gifUrl && (
                <div className="text-center py-6 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Konditions- och rörlighetsövningar har ingen GIF-demonstration.
                  </p>
                </div>
              )}

              {data.gifUrl && (
                <div className="rounded-lg overflow-hidden bg-secondary border border-border">
                  <img src={data.gifUrl} alt={`Demonstration av ${exerciseName}`} className="w-full h-auto" loading="lazy" />
                </div>
              )}

              {!data.gifUrl && data.imageUrls && data.imageUrls.length > 0 && (
                <div className="space-y-1.5">
                  <div className={`grid ${data.imageUrls.length >= 2 ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
                    {data.imageUrls.slice(0, 2).map((url, i) => (
                      <div key={i} className="rounded-lg overflow-hidden bg-white border border-border">
                        <img src={url} alt={`${exerciseName} position ${i + 1}`} className="w-full h-auto" loading="lazy" />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">
                    {data.imageUrls.length >= 2 ? "Start- och slutposition" : "Illustration"}
                  </p>
                </div>
              )}

              {data.name && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Engelsk benämning:</span> {data.name.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </p>
              )}

              {data.targetMuscles && data.targetMuscles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.targetMuscles.map((m, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold capitalize">{m}</span>
                  ))}
                  {data.equipments?.map((e, i) => (
                    <span key={`eq-${i}`} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">{e}</span>
                  ))}
                </div>
              )}

              {/* Reported state — no description shown */}
              {data.isReported && !editing && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-1.5">
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5" /> Rapporterad beskrivning
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Beskrivningen för denna övning har rapporterats som felaktig. Ingen beskrivning visas tills admin granskat den{canEditDescription ? " — du kan skriva en korrekt beskrivning nedan." : "."}
                  </p>
                  {canEditDescription && (
                    <button onClick={startEditing} className="text-xs text-primary font-semibold flex items-center gap-1 hover:opacity-80 mt-1">
                      <Pencil className="w-3 h-3" /> Skriv beskrivning
                    </button>
                  )}
                </div>
              )}

              {editing ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-foreground">Redigera instruktioner</h4>
                    {data.hasCustomInstructions && (
                      <span className="text-[10px] text-primary font-medium">Anpassad</span>
                    )}
                  </div>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder="Skriv en instruktion per rad..."
                    className="allow-select w-full bg-secondary text-foreground text-sm p-3 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground min-h-[150px] resize-y"
                    rows={8}
                  />
                  <p className="text-[10px] text-muted-foreground">En instruktion per rad. Numrering läggs till automatiskt.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(false)} className="flex-1 py-2.5 bg-secondary text-muted-foreground text-sm font-semibold rounded-lg hover:bg-muted transition-colors">
                      Avbryt
                    </button>
                    <button
                      onClick={saveInstructions}
                      disabled={saving || !editText.trim()}
                      className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Spara
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {data.instructions && data.instructions.length > 0 && !data.isReported && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-foreground">
                          {isUnreviewedAi ? "AI-förslag (ej granskat)" : "Instruktioner"}
                        </h4>
                        <div className="flex items-center gap-2">
                          {!isUnreviewedAi && canEditDescription && (
                            <button onClick={startEditing} className="text-[10px] text-primary font-semibold flex items-center gap-1 hover:opacity-80">
                              <Pencil className="w-3 h-3" /> Redigera
                            </button>
                          )}
                        </div>
                      </div>
                      {data.hasCustomInstructions && (
                        <p className="text-[10px] text-primary font-medium">✏️ Anpassade instruktioner</p>
                      )}
                      {isUnreviewedAi && (
                        <div className="flex items-start gap-1.5 p-2 rounded-md bg-primary/5 border border-primary/20">
                          <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                          <p className="text-[11px] text-muted-foreground">
                            Förslag genererat av AI. {canEditDescription
                              ? "Granska och godkänn, redigera eller rapportera om beskrivningen är fel."
                              : "Inte godkänd av övningens skapare än. Rapportera om beskrivningen är fel."}
                          </p>
                        </div>
                      )}
                      <ol className="space-y-1 list-decimal list-inside">
                        {data.instructions.map((inst, i) => (
                          <li key={i} className="text-xs text-muted-foreground">
                            {inst.replace(/^(Step|Steg)\s*:?\s*\d+\s*:?\s*/i, "")}
                          </li>
                        ))}
                      </ol>

                      {/* Action row for unreviewed AI */}
                      {isUnreviewedAi && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {canEditDescription && (
                            <>
                              <button
                                onClick={approveAi}
                                disabled={saving}
                                className="flex-1 min-w-[90px] py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                              >
                                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                Godkänn
                              </button>
                              <button
                                onClick={startEditing}
                                className="flex-1 min-w-[90px] py-2 bg-secondary text-foreground text-xs font-semibold rounded-lg hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Redigera
                              </button>
                            </>
                          )}
                          {!isAdmin && authUserId && (
                            <button
                              onClick={() => setShowReport(true)}
                              className="flex-1 min-w-[90px] py-2 border border-border text-muted-foreground text-xs font-semibold rounded-lg hover:bg-secondary transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Flag className="w-3.5 h-3.5" /> Rapportera
                            </button>
                          )}
                        </div>
                      )}

                      {/* Report option for non-creators on any non-reviewed description */}
                      {!isUnreviewedAi && !data.hasCustomInstructions && !isAdmin && !isCreator && authUserId && (
                        <button
                          onClick={() => setShowReport(true)}
                          className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 hover:text-foreground mt-1"
                        >
                          <Flag className="w-3 h-3" /> Rapportera felaktig beskrivning
                        </button>
                      )}
                    </div>
                  )}

                  {(!data.instructions || data.instructions.length === 0) && !data.isReported && canEditDescription && (
                    <button
                      onClick={startEditing}
                      className="text-xs text-primary font-semibold flex items-center gap-1 mx-auto hover:opacity-80"
                    >
                      <Pencil className="w-3 h-3" /> Skriv instruktioner
                    </button>
                  )}
                </>
              )}

              {/* Report dialog inline */}
              {showReport && (
                <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-2">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5" /> Rapportera felaktig beskrivning
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Beskrivningen tas bort tills admin har granskat. Berätta gärna kort vad som är fel.
                  </p>
                  <textarea
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="(Valfritt) Vad är fel?"
                    maxLength={500}
                    className="allow-select w-full bg-card text-foreground text-xs p-2 rounded-md border border-border outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowReport(false); setReportReason(""); }}
                      className="flex-1 py-2 bg-secondary text-muted-foreground text-xs font-semibold rounded-lg hover:bg-muted"
                    >
                      Avbryt
                    </button>
                    <button
                      onClick={submitReport}
                      disabled={reporting}
                      className="flex-1 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      {reporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
                      Skicka
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExerciseInfoDialog;
