/**
 * Keeps the chat composer anchored to the bottom of the screen.
 *
 * Two CSS variables are measured directly from the DOM / visual viewport:
 * - `--grim-nav-offset`: distance from the viewport bottom to the real top
 *   edge of the bottom tab bar (0 when hidden).
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
      setVar("--grim-nav-offset", 0);
      return;
    }

    const rect = nav.getBoundingClientRect();
    const style = getComputedStyle(nav);
    const visible = rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";

    // `window.innerHeight` tracks the *visual* viewport (it grows/shrinks with
    // the mobile URL bar), while `position: fixed` is laid out against the
    // *layout* viewport (documentElement.clientHeight). Mixing them made the
    // composer float far above the tab bar whenever the URL bar was hidden.
    // The nav is `bottom: 0`, so its own height is the true offset; clientHeight
    // math only acts as a guard if the nav is ever shifted upwards.
    const layoutHeight = document.documentElement.clientHeight || window.innerHeight;
    const offset = Math.max(rect.height, Math.min(layoutHeight - rect.top, layoutHeight));
    setVar("--grim-nav-offset", visible ? Math.max(0, offset) : 0);
  };

  let baselineViewportHeight = window.visualViewport?.height ?? window.innerHeight;

  const measureKeyboard = () => {
    const vv = window.visualViewport;
    if (!vv) {
      setVar("--grim-keyboard-inset", 0);
      return;
    }
    if (!hasFocusedTextInput()) {
      // No editable focus => no keyboard; current height is the baseline.
      baselineViewportHeight = Math.max(vv.height, 0);
      setVar("--grim-keyboard-inset", 0);
      return;
    }
    // Overlay-mode WebViews keep the layout viewport at full size while the
    // visual viewport shrinks. Resize-mode WebViews shrink both, giving 0.
    const inset = Math.max(0, baselineViewportHeight - vv.height - vv.offsetTop);
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
  "max(var(--grim-nav-offset, 0px), var(--grim-keyboard-inset, 0px), var(--grim-bottom-safe, env(safe-area-inset-bottom, 0px)))";
