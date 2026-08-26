import { useEffect, useState } from "react";

/**
 * Returns the correct `bottom` offset (in px) for a fixed chat composer:
 * - Keyboard closed: sits directly on top of the bottom tab bar.
 * - Keyboard open: sits directly on top of the keyboard.
 */
export function useChatComposerBottom() {
  const [bottom, setBottom] = useState(60);

  useEffect(() => {
    const compute = () => {
      const nav = document.querySelector("nav.fixed.bottom-0") as HTMLElement | null;
      const navHeight = nav?.offsetHeight ?? 60;

      const vv = window.visualViewport;
      const keyboard = vv
        ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
        : 0;

      // Keyboard visible -> float just above it, hide behind-nav gap.
      setBottom(keyboard > 80 ? keyboard : navHeight);
    };

    compute();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", compute);
    vv?.addEventListener("scroll", compute);
    window.addEventListener("resize", compute);
    const id = window.setInterval(compute, 500);
    return () => {
      vv?.removeEventListener("resize", compute);
      vv?.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
      window.clearInterval(id);
    };
  }, []);

  return bottom;
}
