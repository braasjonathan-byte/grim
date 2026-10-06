import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  message: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Appens egen bekräftelse för ovanliga men tillåtna värden (ersätter window.confirm). */
export default function ConfirmValueDialog({ message, confirmLabel = "Ja, spara", cancelLabel = "Ändra", onConfirm, onCancel }: Props) {
  return (
    <AlertDialog open={!!message} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stämmer värdet?</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function FieldError({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return <p role="alert" className="text-[11px] leading-tight text-destructive mt-0.5">{error}</p>;
}
