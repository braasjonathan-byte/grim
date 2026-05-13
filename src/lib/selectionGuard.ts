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
  return isEditableTarget(selection.anchorNode, doc) && isEditableTarget(selection.focusNode, doc);
};

export const installSelectionGuard = (doc: Document = document) => {
  let lockUntil = 0;
  let lockTimer: number | undefined;
  let touchStart: { x: number; y: number; target: EventTarget | null } | null = null;

  const clearNonEditableSelection = () => {
    const selection = doc.getSelection();
    if (!selection || selectionIsAllowed(selection, doc)) return;
    selection.removeAllRanges();
  };

  const keepClearingWhileLocked = () => {
    clearNonEditableSelection();
    if (Date.now() >= lockUntil) return;
    lockTimer = window.setTimeout(keepClearingWhileLocked, 40);
  };

  const lockNonEditableSelection = (duration = 1200) => {
    lockUntil = Math.max(lockUntil, Date.now() + duration);
    doc.documentElement.classList.add("selection-locked");
    clearNonEditableSelection();
    if (lockTimer === undefined) keepClearingWhileLocked();
    window.setTimeout(() => {
      if (Date.now() < lockUntil) return;
      doc.documentElement.classList.remove("selection-locked");
      lockTimer = undefined;
      clearNonEditableSelection();
    }, duration + 80);
  };

  const clearSoon = () => {
    clearNonEditableSelection();
    window.requestAnimationFrame?.(clearNonEditableSelection);
    window.setTimeout(clearNonEditableSelection, 0);
    window.setTimeout(clearNonEditableSelection, 120);
  };

  doc.addEventListener("selectstart", (event) => {
    if (isEditableTarget(event.target, doc)) return;
    event.preventDefault();
    lockNonEditableSelection();
  }, { capture: true });

  doc.addEventListener("selectionchange", clearSoon);

  doc.addEventListener("pointerdown", (event) => {
    if (isEditableTarget(event.target, doc)) return;
    lockNonEditableSelection(event.pointerType === "touch" ? 1600 : 900);
    if (event.pointerType === "mouse") event.preventDefault();
  }, { capture: true });

  doc.addEventListener("pointermove", (event) => {
    if (!isEditableTarget(event.target, doc)) clearSoon();
  }, { capture: true });

  doc.addEventListener("pointerup", (event) => {
    if (!isEditableTarget(event.target, doc)) lockNonEditableSelection(500);
  }, { capture: true });

  doc.addEventListener("pointercancel", (event) => {
    if (!isEditableTarget(event.target, doc)) lockNonEditableSelection(500);
  }, { capture: true });

  doc.addEventListener("mousedown", (event) => {
    if (isEditableTarget(event.target, doc)) return;
    event.preventDefault();
    lockNonEditableSelection();
  }, { capture: true });

  doc.addEventListener("mouseup", (event) => {
    if (!isEditableTarget(event.target, doc)) lockNonEditableSelection(500);
  }, { capture: true });

  doc.addEventListener("touchstart", (event) => {
    if (isEditableTarget(event.target, doc)) return;
    const touch = event.touches[0];
    touchStart = touch ? { x: touch.clientX, y: touch.clientY, target: event.target } : null;
    lockNonEditableSelection(1800);
  }, { capture: true, passive: true });

  doc.addEventListener("touchmove", (event) => {
    if (isEditableTarget(event.target, doc)) return;
    const touch = event.touches[0];
    if (touchStart && touch) {
      const dx = Math.abs(touch.clientX - touchStart.x);
      const dy = Math.abs(touch.clientY - touchStart.y);
      if (dx > 8 && dx > dy * 1.15) event.preventDefault();
    }
    clearSoon();
  }, { capture: true, passive: false });

  doc.addEventListener("touchend", (event) => {
    touchStart = null;
    if (!isEditableTarget(event.target, doc)) lockNonEditableSelection(700);
  }, { capture: true, passive: true });

  doc.addEventListener("touchcancel", (event) => {
    touchStart = null;
    if (!isEditableTarget(event.target, doc)) lockNonEditableSelection(700);
  }, { capture: true, passive: true });

  doc.addEventListener("contextmenu", (event) => {
    if (isEditableTarget(event.target, doc)) return;
    event.preventDefault();
    lockNonEditableSelection();
  }, { capture: true });

  doc.addEventListener("copy", (event) => {
    const selection = doc.getSelection();
    if (selection && !selectionIsAllowed(selection, doc)) event.preventDefault();
  }, { capture: true });

  doc.addEventListener("dragstart", (event) => {
    if (!isEditableTarget(event.target, doc)) event.preventDefault();
  }, { capture: true });
};
