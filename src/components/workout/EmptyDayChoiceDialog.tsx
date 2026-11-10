import { Download, X } from "lucide-react";

interface EmptyDayChoiceDialogProps {
  day: string;
  name: string;
  onNameChange: (value: string) => void;
  onClose: () => void;
  onCreate: () => void | Promise<void>;
  onImport: () => void;
}

/** Tom dag / vilodag: skapa tomt pass ELLER importera färdigt pass. Utbrutet ur WorkoutView (åtgärd 24). */
const EmptyDayChoiceDialog = ({ day, name, onNameChange, onClose, onCreate, onImport }: EmptyDayChoiceDialogProps) => (
  <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
    <div className="absolute inset-0 bg-black/60" onClick={onClose} />
    <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base">Lägg till pass · {day}</h3>
        <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Passnamn</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="t.ex. Styrka överkropp"
          className="w-full bg-secondary text-secondary-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          autoFocus
        />
        <button
          onClick={() => { void onCreate(); }}
          disabled={!name.trim()}
          className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 text-sm"
        >
          Skapa tomt pass
        </button>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">eller</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <button
        onClick={onImport}
        className="w-full py-2.5 border border-warning/40 text-warning font-semibold rounded-lg hover:border-warning hover:bg-warning/5 text-sm flex items-center justify-center gap-2"
      >
        <Download className="w-3.5 h-3.5" /> Importera färdigt pass
      </button>
    </div>
  </div>
);

export default EmptyDayChoiceDialog;
