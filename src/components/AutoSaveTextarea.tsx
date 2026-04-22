import { useState, useRef, useEffect, useCallback } from "react";

interface AutoSaveTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'onBlur' | 'value' | 'defaultValue'> {
  initialValue: string;
  onSave: (value: string) => void;
  debounceMs?: number;
}

const AutoSaveTextarea = ({ initialValue, onSave, debounceMs = 800, ...props }: AutoSaveTextareaProps) => {
  const [value, setValue] = useState(initialValue);
  const valueRef = useRef(initialValue);
  const lastSaved = useRef(initialValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Only sync from external initialValue when it's a genuinely new external value.
  // Avoid overwriting what the user is currently typing or pending debounced saves.
  useEffect(() => {
    if (initialValue === valueRef.current) return;
    if (initialValue === lastSaved.current) return;
    const hasPendingEdit = valueRef.current !== lastSaved.current;
    if (hasPendingEdit) return;
    setValue(initialValue);
    valueRef.current = initialValue;
    lastSaved.current = initialValue;
  }, [initialValue]);

  const doSave = useCallback((val: string) => {
    if (val !== lastSaved.current) {
      lastSaved.current = val;
      onSaveRef.current(val);
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setValue(newVal);
    valueRef.current = newVal;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSave(newVal), debounceMs);
  }, [debounceMs, doSave]);

  const handleBlur = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    doSave(value);
  }, [value, doSave]);

  useEffect(() => {
    const save = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } doSave(valueRef.current); };
    const onVis = () => { if (document.visibilityState === "hidden") save(); };
    window.addEventListener("beforeunload", save);
    document.addEventListener("visibilitychange", onVis);
    return () => { window.removeEventListener("beforeunload", save); document.removeEventListener("visibilitychange", onVis); if (timerRef.current) clearTimeout(timerRef.current); doSave(valueRef.current); };
  }, [doSave]);

  return <textarea {...props} value={value} onChange={handleChange} onBlur={handleBlur} />;
};

export default AutoSaveTextarea;
