import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share2, X } from "lucide-react";

interface ShareWorkoutPromptDialogProps {
  open: boolean;
  onConfirm: () => void;
  onSkip: () => void;
}

const ShareWorkoutPromptDialog = ({ open, onConfirm, onSkip }: ShareWorkoutPromptDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onSkip(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" /> Dela passet?
          </DialogTitle>
          <DialogDescription>
            Snyggt jobbat! Vill du dela detta pass med dina vänner i flödet?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          <Button onClick={onConfirm} className="w-full">
            <Share2 className="w-4 h-4" /> Ja, dela med vänner
          </Button>
          <Button variant="outline" onClick={onSkip} className="w-full">
            <X className="w-4 h-4" /> Nej tack
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareWorkoutPromptDialog;
