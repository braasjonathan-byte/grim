const editableSelector = 'input, textarea, select, [contenteditable="true"], .allow-select';

const getElementFromTarget = (target: EventTarget | Node | null, doc: Document = document) => {
  const view = doc.defaultView ?? window;
  if (target instanceof view.Element) return target;
  if (target instanceof view.Node) return target.parentElement;
  return null;
};

const isEditableTarget = (target: EventTarget | Node | null, doc: Document = document) => {
  return !!getElementFromTarget(target, doc)?.closest(editableSelector);
};

const selectionIsAllowed = (selection: Selection, doc: Document = document) => {
  if (!selection.anchorNode || !selection.focusNode) return true;
  // Selections that originate inside or around an <input>/<textarea> have
  // their anchor/focus on the parent (the actual text lives in shadow DOM).
  // Allow any selection that touches an editable region — the browser keeps
  // the real caret/selection inside the input itself.
  return isEditableTarget(selection.anchorNode, doc) || isEditableTarget(selection.focusNode, doc);
};

/**
 * Lightweight selection guard.
 *
 * Strategy: rely on the global `user-select: none` CSS rule (already in
 * index.css) to prevent text selection on app chrome, and only intercept
 * `selectstart` to cancel selection attempts that originate outside an
 * editable field. We deliberately avoid attaching pointer/touch/mouse
 * listeners on `document` because non-passive listeners (especially
 * `touchmove`) interfere with the touch→click→focus sequence on Android
 * Chrome and can prevent the soft keyboard from opening when tapping
 * inputs.
 */
export const installSelectionGuard = (doc: Document = document) => {
  doc.addEventListener("selectstart", (event) => {
    if (isEditableTarget(event.target, doc)) return;
    event.preventDefault();
  }, { capture: true });

  doc.addEventListener("selectionchange", () => {
    const selection = doc.getSelection();
    if (!selection || selectionIsAllowed(selection, doc)) return;
    selection.removeAllRanges();
  });

  doc.addEventListener("contextmenu", (event) => {
    if (isEditableTarget(event.target, doc)) return;
    event.preventDefault();
  }, { capture: true });

  doc.addEventListener("copy", (event) => {
    const selection = doc.getSelection();
    if (selection && !selectionIsAllowed(selection, doc)) event.preventDefault();
  }, { capture: true });

  doc.addEventListener("dragstart", (event) => {
    if (!isEditableTarget(event.target, doc)) event.preventDefault();
  }, { capture: true });
};
