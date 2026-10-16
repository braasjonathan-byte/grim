import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Row = { id: string; exercise_name: string };

/** Övningar som gömts ur konditionslistans väljare. Syns igen för alla när raden tas bort. */
export default function AdminHiddenExercises() {
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from("hidden_exercises").select("id, exercise_name").order("exercise_name");
    if (error) return toast.error(error.message);
    setRows((data || []) as Row[]);
  };
  useEffect(() => { load(); }, []);

  const restore = async (row: Row) => {
    const { error } = await supabase.from("hidden_exercises").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    setRows((list) => list?.filter((r) => r.id !== row.id) ?? []);
    toast.success(`${row.exercise_name} syns i listan igen`);
  };

  if (!rows) return null;
  if (rows.length === 0) return <p className="text-[11px] text-muted-foreground">Ingen konditionsövning är dold.</p>;

  return (
    <ul className="divide-y divide-border text-sm">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-2 py-2">
          <span className="min-w-0 flex-1">{row.exercise_name}</span>
          <Button size="sm" variant="outline" onClick={() => restore(row)}>Visa igen</Button>
        </li>
      ))}
    </ul>
  );
}
