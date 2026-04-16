import { useEffect } from "react";

const ALLOWED_SCROLL_SELECTOR = "[data-scroll-lock-scroll='y']";

const getAllowedScrollableElement = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof Element)) return null;
  return target.closest(ALLOWED_SCROLL_SELECTOR) as HTMLElement | null;
};

const hasVerticalOverflow = (element: HTMLElement) => element.scrollHeight > element.clientHeight + 1;

export const useLockBodyScroll = (active = true) => {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const { body, documentElement } = document;
    const scrollY = window.scrollY;

    const previousStyles = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
      htmlOverflow: documentElement.style.overflow,
      htmlOverscrollBehavior: documentElement.style.overscrollBehavior,
    };

    documentElement.style.overflow = "hidden";
    documentElement.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overscrollBehavior = "none";

    let lastTouchY = 0;

    const handleTouchStart = (event: TouchEvent) => {
      lastTouchY = event.touches[0]?.clientY ?? 0;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const currentTouchY = event.touches[0]?.clientY ?? lastTouchY;
      const deltaY = currentTouchY - lastTouchY;
      lastTouchY = currentTouchY;

      const scrollable = getAllowedScrollableElement(event.target);

      if (!scrollable || !hasVerticalOverflow(scrollable)) {
        event.preventDefault();
        return;
      }

      const isAtTop = scrollable.scrollTop <= 0;
      const isAtBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;

      if ((deltaY > 0 && isAtTop) || (deltaY < 0 && isAtBottom)) {
        event.preventDefault();
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);

      documentElement.style.overflow = previousStyles.htmlOverflow;
      documentElement.style.overscrollBehavior = previousStyles.htmlOverscrollBehavior;
      body.style.overflow = previousStyles.bodyOverflow;
      body.style.position = previousStyles.bodyPosition;
      body.style.top = previousStyles.bodyTop;
      body.style.left = previousStyles.bodyLeft;
      body.style.right = previousStyles.bodyRight;
      body.style.width = previousStyles.bodyWidth;
      body.style.overscrollBehavior = previousStyles.bodyOverscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, [active]);
};