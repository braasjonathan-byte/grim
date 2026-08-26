/**
 * Keeps the CSS variable `--grim-composer-bottom` in sync with the correct
 * bottom offset for the fixed chat composer:
 * - Keyboard closed: sits directly on top of the bottom tab bar.
 * - Keyboard open: sits directly on top of the keyboard.
 *
 * Imported for side effect; no React wiring needed.
 */
if (typeof window !== "undefined") {
  const compute = () => {
    const nav = document.querySelector("nav.fixed.bottom-0") as HTMLElement | null;
    const navHeight = nav?.offsetHeight ?? 60;

    const vv = window.visualViewport;
    const keyboard = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;

    const bottom = keyboard > 80 ? keyboard : navHeight;
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
