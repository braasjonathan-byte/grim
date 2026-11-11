/**
 * Delad layout för Dialog och AlertDialog:
 * – mobil (< sm): bottom sheet, fäst mot skärmens nederkant med rundade övre hörn (16 px)
 *   och en synlig scrim bakom. Safe-area-utfyllnad läggs till som ett eget element (se
 *   SheetSafeAreaSpacer) så att den inte försvinner när en dialog sätter egen padding.
 * – sm och uppåt: centrerad dialog med 16 px radie, som tidigare.
 */
export const RESPONSIVE_SHEET_CLASSES = [
  "fixed z-50 grid gap-4 bg-background p-6 shadow-lg",
  // Mobil: bottom sheet
  "inset-x-0 bottom-0 top-auto mx-auto w-full max-w-lg max-h-[92dvh] overflow-y-auto",
  "rounded-t-2xl rounded-b-none border border-x-0 border-b-0",
  "duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  "data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full",
  // sm+: centrerad dialog
  "sm:inset-x-auto sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:mx-0 sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:border",
  "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
  "sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]",
].join(" ");

/** Höjd för hemindikator/systemnavigering under ett bottom sheet (bara mobil). */
export const SHEET_SAFE_AREA_STYLE = {
  height: "var(--grim-bottom-safe, env(safe-area-inset-bottom, 0px))",
} as const;
