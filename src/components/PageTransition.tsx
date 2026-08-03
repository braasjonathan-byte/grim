import { ReactNode, useEffect, useRef, useState } from "react";

/**
 * Soft fade/slide transition between bottom-nav tabs.
 * Renders the outgoing content until the fade-out finishes, then swaps in the new tab.
 */
const PageTransition = ({ tabKey, children }: { tabKey: string; children: ReactNode }) => {
  const [shown, setShown] = useState<{ key: string; node: ReactNode }>({ key: tabKey, node: children });
  const [phase, setPhase] = useState<"in" | "out">("in");
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (tabKey === shown.key) {
      // Same tab – keep children fresh without animating.
      setShown({ key: tabKey, node: children });
      return;
    }
    setPhase("out");
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setShown({ key: tabKey, node: children });
      setPhase("in");
    }, 120);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabKey, children]);

  return (
    <div
      data-tab-key={shown.key}
      className={phase === "in" ? "tab-transition-in" : "tab-transition-out"}
    >
      {shown.node}
    </div>
  );
};

export default PageTransition;
