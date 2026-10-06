import { useState, useRef, useEffect, useCallback } from "react";
import { validateNumber, toStorageString, type NumberRule, type RuleName } from "@/lib/inputValidation";
import ConfirmValueDialog from "@/components/ConfirmValueDialog";

interface AutoSaveInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onBlur' | 'value' | 'defaultValue'> {
  initialValue: string;
  onSave: (value: string) => void;
  debounceMs?: number;
  normalizeOnBlur?: (value: string) => string;
  /** Transformerar varje tangenttryck, t.ex. "." → ":" för tempo. */
  sanitize?: (value: string) => string;
  /** Valideringsregel. Ogiltiga värden sparas aldrig och felet visas under fältet. */
  rule?: NumberRule | RuleName;
  /** Returnerar en fråga om värdet är ovanligt men tillåtet; sparas först efter "Ja, spara". */
  confirmValue?: (value: number) => string | null;
}

const isNumericType = (t: unknown) => t === "number";
const toDisplay = (v: string) => (/^-?\d+\.\d+$/.test(v) ? v.replace(".", ",") : v);

/**
 * Input that auto-saves on every keystroke (debounced) and on blur.
 * Numeriska fält renderas som textfält med decimaltangentbord, så att både
 * "82,5" och "82.5" sparas som 82.5. Värdet ersätts alltid, aldrig konkateneras.
 */
const AutoSaveInput = ({ initialValue, onSave, debounceMs = 800, normalizeOnBlur, sanitize, rule, confirmValue, type, inputMode, ...props }: AutoSaveInputProps) => {
  const numeric = isNumericType(type) || !!rule;
  const display = (v: string) => (numeric ? toDisplay(v) : v);
  const [value, setValue] = useState(display(initialValue));
  const [error, setError] = useState<string | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const pendingConfirm = useRef<string | null>(null);
  const valueRef = useRef(display(initialValue));
  const lastSaved = useRef(initialValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  const normalizeOnBlurRef = useRef(normalizeOnBlur);
  onSaveRef.current = onSave;
  normalizeOnBlurRef.current = normalizeOnBlur;
  const sanitizeRef = useRef(sanitize);
  sanitizeRef.current = sanitize;
  const ruleRef = useRef(rule);
  ruleRef.current = rule;
  const confirmRef = useRef(confirmValue);
  confirmRef.current = confirmValue;

  const userTouched = useRef(false);
  useEffect(() => {
    if (userTouched.current) return;
    if (initialValue === lastSaved.current && display(initialValue) === valueRef.current) return;
    if (initialValue === lastSaved.current) return;
    const hasPendingEdit = toStorageString(valueRef.current) !== toStorageString(lastSaved.current);
    if (hasPendingEdit && valueRef.current !== display(initialValue)) return;
    const d = display(initialValue);
    setValue(d);
    valueRef.current = d;
    lastSaved.current = initialValue;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  const commit = useCallback((stored: string) => {
    if (stored !== lastSaved.current) {
      lastSaved.current = stored;
      onSaveRef.current(stored);
    }
    userTouched.current = false;
  }, []);

  /** Validerar och sparar. silent = vid stängning/avmontering (ingen dialog). */
  const doSave = useCallback((val: string, silent = false) => {
    const stored = numeric ? toStorageString(val) : val;
    if (stored === lastSaved.current) { userTouched.current = false; setError(null); return; }
    if (ruleRef.current) {
      const res = validateNumber(val, ruleRef.current);
      setError(res.error);
      if (res.error) return; // ogiltigt – sparas aldrig
      if (res.value !== null && confirmRef.current) {
        const msg = confirmRef.current(res.value);
        if (msg) {
          if (silent) return; // bekräftelse krävs – spara inte tyst
          pendingConfirm.current = stored;
          setConfirmMsg(msg);
          return;
        }
      }
    }
    commit(stored);
  }, [numeric, commit]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = sanitizeRef.current ? sanitizeRef.current(e.target.value) : e.target.value;
    userTouched.current = true;
    setValue(newVal);
    valueRef.current = newVal;
    if (ruleRef.current) setError(validateNumber(newVal, ruleRef.current).error);
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
    const normalized = normalizeOnBlurRef.current ? normalizeOnBlurRef.current(value) : value;
    if (normalized !== value) {
      setValue(normalized);
      valueRef.current = normalized;
    }
    doSave(normalized);
  }, [value, doSave]);

  useEffect(() => {
    const saveBeforeLeave = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      doSave(valueRef.current, true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") saveBeforeLeave();
    };
    window.addEventListener("beforeunload", saveBeforeLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", saveBeforeLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timerRef.current) clearTimeout(timerRef.current);
      doSave(valueRef.current, true);
    };
  }, [doSave]);

  const integer = rule ? (typeof rule === "string" ? false : !!rule.integer) : false;
  const input = (
    <input
      {...props}
      type={numeric ? "text" : type}
      inputMode={numeric ? (inputMode === "numeric" || integer ? "numeric" : "decimal") : inputMode}
      aria-invalid={!!error || undefined}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );

  if (!rule) return input;
  const full = /\bw-full\b/.test(String(props.className || ""));
  return (
    <span className={full ? "flex flex-col w-full min-w-0" : "inline-flex flex-col items-center"}>
      {input}
      {error && <span role="alert" className="block text-[10px] leading-tight text-destructive mt-0.5 max-w-[8rem] text-center">{error}</span>}
      <ConfirmValueDialog
        message={confirmMsg}
        onConfirm={() => {
          const s = pendingConfirm.current;
          pendingConfirm.current = null;
          setConfirmMsg(null);
          if (s !== null) commit(s);
        }}
        onCancel={() => {
          // "Ändra": spara ingenting, återställ till senast sparade värde
          pendingConfirm.current = null;
          setConfirmMsg(null);
          const d = display(lastSaved.current);
          setValue(d);
          valueRef.current = d;
          userTouched.current = false;
        }}
      />
    </span>
  );
};

export default AutoSaveInput;
