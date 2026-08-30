import { X, TrendingUp } from "lucide-react";
import ExerciseHistoryPanel from "@/components/ExerciseHistoryPanel";

interface ExerciseHistoryDialogProps {
  exerciseName: string;
  userId: string;
  onClose: () => void;
}

const ExerciseHistoryDialog = ({ exerciseName, userId, onClose }: ExerciseHistoryDialogProps) => {
  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-card border-t border-border sm:border sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Historik</p>
              <p className="text-sm font-black truncate">{exerciseName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary" aria-label="Stäng">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <ExerciseHistoryPanel exerciseName={exerciseName} userId={userId} limit={15} />
        </div>
      </div>
    </div>
  );
};

export default ExerciseHistoryDialog;
