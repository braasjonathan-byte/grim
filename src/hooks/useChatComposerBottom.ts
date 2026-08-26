/**
 * Keeps the CSS variable `--grim-composer-bottom` in sync with the correct
 * bottom offset for the fixed chat composer:
 * - Keyboard closed: sits directly on top of the bottom tab bar.
 * - Keyboard open: sits directly on top of the keyboard.
 *
 * Imported for side effect; no React wiring needed.
 */
if (typeof window !== "undefined") {
  let largestViewportHeight = window.visualViewport?.height ?? window.innerHeight;

  const hasFocusedTextInput = () => {
    const active = document.activeElement;
    return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement || (active instanceof HTMLElement && active.isContentEditable);
  };

  const compute = () => {
    const nav = document.querySelector("nav.fixed.bottom-0") as HTMLElement | null;
    const navTop = nav?.getBoundingClientRect().top;
    const navClearance = typeof navTop === "number"
      ? Math.max(0, window.innerHeight - navTop)
      : 60;

    const vv = window.visualViewport;
    const inputFocused = hasFocusedTextInput();
    if (vv && !inputFocused) largestViewportHeight = vv.height;

    // Browser chrome and native safe-area adjustments can make innerHeight
    // larger than visualViewport even with the keyboard closed. A keyboard
    // inset is therefore only valid while an editable control has focus and
    // the visual viewport has clearly shrunk from its unfocused baseline.
    const viewportShrink = vv ? largestViewportHeight - vv.height : 0;
    const keyboard = vv && inputFocused && viewportShrink > 120
      ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      : 0;

    // In resize-mode WebViews the layout viewport already ends above the
    // keyboard (keyboard === 0), while overlay-mode browsers need the inset.
    // When closed, measuring the nav's actual top edge avoids duplicated
    // safe-area/browser-chrome offsets and anchors the composer to the footer.
    const bottom = keyboard > 0 ? keyboard : navClearance;
    document.documentElement.style.setProperty("--grim-composer-bottom", `${Math.round(bottom)}px`);
  };

  compute();
  const vv = window.visualViewport;
  vv?.addEventListener("resize", compute);
  vv?.addEventListener("scroll", compute);
  window.addEventListener("resize", compute);
  document.addEventListener("focusin", compute);
  document.addEventListener("focusout", () => window.setTimeout(compute, 250));
  window.setInterval(compute, 500);
}

export const COMPOSER_BOTTOM = "var(--grim-composer-bottom, 60px)";
