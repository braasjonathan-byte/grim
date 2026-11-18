/** Scrolls to the next unfinished strength set row (data-set-row + data-set-done). */
const reduce = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function scrollToRow(el: Element | null | undefined) {
  if (!el) return;
  (el as HTMLElement).scrollIntoView({ behavior: reduce() ? "auto" : "smooth", block: "center" });
}

/** Next undone visible row after `from` in document order; null when the workout is finished. */
export function nextUndoneRow(from: Element | null, root: ParentNode = document): Element | null {
  const rows = Array.from(root.querySelectorAll('[data-set-row][data-set-done="false"]'))
    .filter((r) => (r as HTMLElement).offsetParent !== null);
  if (!from) return rows[0] ?? null;
  return rows.find((r) => from.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING) ?? null;
}
