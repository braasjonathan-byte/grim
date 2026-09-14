import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera } from "lucide-react";
import FormCheckDialog from "@/components/FormCheckDialog";

/** Kort i Verktyg → Hjälpmedel som startar formkollen. */
export default function FormCheckCard() {
  const [open, setOpen] = useState(false);
  const [exercise, setExercise] = useState("");

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Filma ett set rakt från sidan så analyserar appen djup, tempo och symmetri och ger dig tips inför nästa set.
      </p>
      <Input
        value={exercise}
        onChange={(e) => setExercise(e.target.value)}
        placeholder="Vilken övning? (valfritt)"
      />
      <Button className="w-full" onClick={() => setOpen(true)}>
        <Camera className="w-4 h-4 mr-2" /> Starta formkoll
      </Button>
      <FormCheckDialog open={open} onOpenChange={setOpen} exerciseName={exercise.trim() || undefined} />
    </div>
  );
}
