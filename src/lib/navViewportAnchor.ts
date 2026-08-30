/**
 * Keeps the fixed bottom navigation glued to the bottom of the *visual*
 * viewport.
 *
 * `position: fixed; bottom: 0` anchors to the LAYOUT viewport. On mobile
 * browsers (and edge-to-edge Android WebViews) the layout viewport can be
 * taller than what is actually on screen — e.g. while the URL bar collapses /
 * expands during scroll, or during overscroll bounce. The footer then drifts
 * up (or partly off screen) while scrolling instead of staying pinned.
 *
 * This module publishes `--grim-nav-bottom`: the distance from the bottom of
 * the visual viewport to the bottom of the layout viewport. The nav uses it as
 * its `bottom` value so it always renders on the visible bottom edge.
 *
 * The keyboard is intentionally excluded: when a text field is focused the
 * visual viewport shrinks a lot, and the nav should stay behind the keyboard
 * (the chat composer handles keyboard anchoring separately).
 *
 * Imported for side effect; no React wiring needed.
 */
if (typeof window !== "undefined") {
  const root = document.documentElement;
  // Larger gaps than this are keyboard-sized, not URL-bar-sized.
  const MAX_ANCHOR_PX = 140;

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

  const compute = () => {
    const vv = window.visualViewport;
    if (!vv || hasFocusedTextInput()) {
      setVar("--grim-nav-bottom", 0);
      return;
    }
    const layoutHeight = root.clientHeight || window.innerHeight;
    const gap = layoutHeight - (vv.height + vv.offsetTop);
    if (!Number.isFinite(gap) || gap <= 0 || gap > MAX_ANCHOR_PX) {
      setVar("--grim-nav-bottom", 0);
      return;
    }
    setVar("--grim-nav-bottom", gap);
  };

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      compute();
    });
  };

  compute();

  const vv = window.visualViewport;
  vv?.addEventListener("resize", schedule);
  vv?.addEventListener("scroll", schedule);
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", () => window.setTimeout(compute, 150));
  window.addEventListener("pageshow", compute);
  document.addEventListener("focusin", schedule);
  document.addEventListener("focusout", () => window.setTimeout(compute, 250));
}

/** Bottom offset for the fixed bottom navigation. */
export const NAV_BOTTOM = "var(--grim-nav-bottom, 0px)";
