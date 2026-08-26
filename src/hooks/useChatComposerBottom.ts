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

  const compute = () => {
    const nav = document.querySelector("nav.fixed.bottom-0") as HTMLElement | null;
    const navHeight = nav?.offsetHeight ?? 60;

    const vv = window.visualViewport;
    if (vv) largestViewportHeight = Math.max(largestViewportHeight, vv.height);

    // Browser chrome and native safe-area adjustments can make innerHeight
    // larger than visualViewport even with the keyboard closed. Only treat
    // the inset as a keyboard when the visual viewport itself has clearly
    // shrunk from its largest observed height.
    const viewportShrink = vv ? largestViewportHeight - vv.height : 0;
    const keyboard = vv && viewportShrink > 120
      ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      : 0;

    const bottom = keyboard > 120 ? keyboard : navHeight;
    document.documentElement.style.setProperty("--grim-composer-bottom", `${Math.round(bottom)}px`);
  };

  compute();
  const vv = window.visualViewport;
  vv?.addEventListener("resize", compute);
  vv?.addEventListener("scroll", compute);
  window.addEventListener("resize", compute);
  window.setInterval(compute, 500);
}

export const COMPOSER_BOTTOM = "var(--grim-composer-bottom, 60px)";
