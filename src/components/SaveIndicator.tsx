import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { Check, Loader2 } from "lucide-react";

type SaveState = "idle" | "saving" | "saved";

interface SaveIndicatorContextType {
  triggerSave: () => void;
}

const SaveIndicatorContext = createContext<SaveIndicatorContextType>({ triggerSave: () => {} });

export const useSaveIndicator = () => useContext(SaveIndicatorContext);

export const SaveIndicatorProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<SaveState>("idle");

  const triggerSave = useCallback(() => {
    setState("saving");
    const t = setTimeout(() => {
      setState("saved");
      const t2 = setTimeout(() => setState("idle"), 1500);
      return () => clearTimeout(t2);
    }, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <SaveIndicatorContext.Provider value={{ triggerSave }}>
      {children}
      {state !== "idle" && (
        <div className="fixed top-3 right-3 z-[100] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/90 backdrop-blur border border-border shadow-lg text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-200">
          {state === "saving" ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Sparar…</span>
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5 text-primary" />
              <span className="text-primary">Sparat</span>
            </>
          )}
        </div>
      )}
    </SaveIndicatorContext.Provider>
  );
};
