import { useEffect } from "react";

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

    return () => {
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