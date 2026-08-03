CREATE OR REPLACE FUNCTION public.bulk_import_exercise_instructions(p_data jsonb, p_author uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN SELECT key AS name, value AS instr FROM jsonb_each(p_data) LOOP
    UPDATE public.exercise_gif_mappings m
       SET custom_instructions = r.instr, updated_at = now()
     WHERE lower(m.exercise_name) = lower(r.name);
    IF NOT FOUND THEN
      INSERT INTO public.exercise_gif_mappings (exercise_name, exercisedb_name, custom_instructions, created_by)
      VALUES (r.name, r.name, r.instr, p_author);
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_import_exercise_instructions(jsonb, uuid) TO sandbox_exec;