/**
 * Keeps the chat composer anchored to the bottom of the screen.
 *
 * Two CSS variables are measured directly from the DOM / visual viewport:
 * - `--grim-nav-height`: real height of the bottom tab bar (0 when hidden).
 * - `--grim-keyboard-inset`: height the software keyboard covers, and only
 *   while an editable control actually has focus.
 *
 * The composer then uses `max()` of those two plus the safe area, so a stale
 * or missing value can never leave a gap: the composer falls back to sitting
 * exactly on top of the tab bar (or the safe area when the bar is hidden).
 *
 * Imported for side effect; no React wiring needed.
 */
if (typeof window !== "undefined") {
  const root = document.documentElement;

  const setVar = (name: string, px: number) => {
    const next = `${Math.round(px)}px`;
    if (root.style.getPropertyValue(name) !== next) root.style.setProperty(name, next);
  };

  const hasFocusedTextInput = () => {
    const active = document.activeElement;
    return (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      (active instanceof HTMLElement && active.isContentEditable)
    );
  };

  let navObserver: ResizeObserver | null = null;
  let observedNav: HTMLElement | null = null;

  const measureNav = () => {
    const nav = document.querySelector("nav.fixed.bottom-0") as HTMLElement | null;

    if (nav !== observedNav) {
      navObserver?.disconnect();
      observedNav = nav;
      if (nav && typeof ResizeObserver !== "undefined") {
        navObserver = new ResizeObserver(() => measureNav());
        navObserver.observe(nav);
      }
    }

    if (!nav) {
      setVar("--grim-nav-height", 0);
      return;
    }

    const rect = nav.getBoundingClientRect();
    const visible = rect.height > 0 && getComputedStyle(nav).visibility !== "hidden";
    setVar("--grim-nav-height", visible ? rect.height : 0);
  };

  const measureKeyboard = () => {
    const vv = window.visualViewport;
    if (!vv || !hasFocusedTextInput()) {
      setVar("--grim-keyboard-inset", 0);
      return;
    }
    // Overlay-mode WebViews keep `innerHeight` at full screen size while the
    // visual viewport shrinks. Resize-mode WebViews shrink both, giving 0.
    const inset = window.innerHeight - vv.height - vv.offsetTop;
    setVar("--grim-keyboard-inset", inset > 80 ? inset : 0);
  };

  const compute = () => {
    measureNav();
    measureKeyboard();
  };

  compute();

  const vv = window.visualViewport;
  vv?.addEventListener("resize", compute);
  vv?.addEventListener("scroll", compute);
  window.addEventListener("resize", compute);
  window.addEventListener("orientationchange", () => window.setTimeout(compute, 150));
  window.addEventListener("pageshow", compute);
  document.addEventListener("focusin", compute);
  document.addEventListener("focusout", () => {
    // Clear the keyboard inset immediately so no empty gap is left behind,
    // then re-measure once the viewport animation has settled.
    setVar("--grim-keyboard-inset", 0);
    window.setTimeout(compute, 250);
  });
  window.setInterval(compute, 500);
}

/**
 * Bottom offset for the fixed chat composer. Never smaller than the tab bar
 * height / safe area, and lifts with the keyboard when it is open.
 */
export const COMPOSER_BOTTOM =
  "max(var(--grim-nav-height, 0px), var(--grim-keyboard-inset, 0px), var(--grim-bottom-safe, env(safe-area-inset-bottom, 0px)))";
