/**
 * Keeps the chat composer anchored to the bottom of the screen.
 *
 * One effective CSS offset is selected from two mutually exclusive states:
 * the real bottom-nav height while the keyboard is closed, or the keyboard
 * inset while it is open. Adding/maxing both offsets creates the characteristic
 * empty gap above the keyboard in resize-mode Android WebViews.
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
  let navHeight = 0;
  let keyboardInset = 0;
  let keyboardVisible = false;

  const applyComposerOffset = () => {
    const focused = hasFocusedTextInput();
    setVar("--grim-composer-offset", focused && keyboardVisible ? keyboardInset : navHeight);
  };

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
      navHeight = 0;
      applyComposerOffset();
      return;
    }

    const rect = nav.getBoundingClientRect();
    const style = getComputedStyle(nav);
    const visible = rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";

    // The nav itself is fixed at bottom:0 and already contains the safe-area
    // padding. Its rendered height is therefore the only coordinate-independent
    // distance the composer needs. Mixing rect.top with clientHeight is wrong in
    // edge-to-edge WebViews, where those values can use different viewports.
    navHeight = visible ? Math.max(0, rect.height) : 0;
    setVar("--grim-nav-offset", navHeight);
    applyComposerOffset();
  };

  let baselineViewportHeight = window.visualViewport?.height ?? window.innerHeight;
  let baselineLayoutHeight = document.documentElement.clientHeight || window.innerHeight;

  const measureKeyboard = () => {
    const vv = window.visualViewport;
    if (!vv) {
      keyboardVisible = false;
      keyboardInset = 0;
      setVar("--grim-keyboard-inset", keyboardInset);
      applyComposerOffset();
      return;
    }
    if (!hasFocusedTextInput()) {
      // No editable focus => no keyboard; current height is the baseline.
      baselineViewportHeight = Math.max(vv.height, 0);
      baselineLayoutHeight = document.documentElement.clientHeight || window.innerHeight;
      keyboardVisible = false;
      keyboardInset = 0;
      setVar("--grim-keyboard-inset", keyboardInset);
      applyComposerOffset();
      return;
    }
    const visualShrink = Math.max(0, baselineViewportHeight - vv.height - vv.offsetTop);
    const layoutHeight = document.documentElement.clientHeight || window.innerHeight;
    const layoutShrink = Math.max(0, baselineLayoutHeight - layoutHeight);

    // In resize-mode the fixed containing block already ends above the keyboard,
    // so bottom:0 is correct. Only overlay-mode requires the visual inset.
    keyboardVisible = visualShrink > 80;
    keyboardInset = keyboardVisible && layoutShrink <= 80 ? visualShrink : 0;
    setVar("--grim-keyboard-inset", keyboardInset);
    applyComposerOffset();
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
    keyboardVisible = false;
    keyboardInset = 0;
    setVar("--grim-keyboard-inset", keyboardInset);
    applyComposerOffset();
    window.setTimeout(compute, 250);
  });
  window.setInterval(compute, 500);
}

/**
 * Bottom offset for the fixed chat composer. Never smaller than the tab bar
 * height / safe area, and lifts with the keyboard when it is open.
 */
export const COMPOSER_BOTTOM =
  "var(--grim-composer-offset, var(--grim-bottom-safe, env(safe-area-inset-bottom, 0px)))";
