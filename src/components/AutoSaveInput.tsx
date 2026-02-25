import { useState, useRef, useEffect, useCallback } from "react";

interface AutoSaveInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onBlur' | 'value' | 'defaultValue'> {
  initialValue: string;
  onSave: (value: string) => void;
  debounceMs?: number;
}

/**
 * Input that auto-saves on every keystroke (debounced) and on blur.
 * Also saves before page unload to prevent data loss on app restart.
 */
const AutoSaveInput = ({ initialValue, onSave, debounceMs = 800, ...props }: AutoSaveInputProps) => {
  const [value, setValue] = useState(initialValue);
  const lastSaved = useRef(initialValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Sync if initialValue changes externally
  useEffect(() => {
    setValue(initialValue);
    lastSaved.current = initialValue;
  }, [initialValue]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Use the latest value from the ref
  }, []);

  const doSave = useCallback((val: string) => {
    if (val !== lastSaved.current) {
      lastSaved.current = val;
      onSaveRef.current(val);
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setValue(newVal);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      doSave(newVal);
    }, debounceMs);
  }, [debounceMs, doSave]);

  const handleBlur = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    doSave(value);
  }, [value, doSave]);

  // Save on page unload / visibility hidden (mobile close)
  useEffect(() => {
    const saveBeforeLeave = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Read current value from state
      doSave(value);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveBeforeLeave();
      }
    };

    window.addEventListener("beforeunload", saveBeforeLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", saveBeforeLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, doSave]);

  return (
    <input
      {...props}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
};

export default AutoSaveInput;
