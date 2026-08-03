import { toast } from "sonner";

/**
 * Show a small floating "Ångra" toast for 5 seconds after a destructive action.
 * The undo callback is only run if the user taps the button before it closes.
 */
export function showUndoToast(message: string, onUndo: () => void | Promise<void>) {
  let undone = false;
  toast(message, {
    duration: 5000,
    action: {
      label: "Ångra",
      onClick: () => {
        if (undone) return;
        undone = true;
        Promise.resolve(onUndo()).catch(() => {
          toast.error("Kunde inte ångra");
        });
      },
    },
  });
}
