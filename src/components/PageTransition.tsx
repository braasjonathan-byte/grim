import { ReactNode, useEffect, useRef, useState } from "react";

/**
 * Soft slide+fade transition between tabs. Uses CSS keyframe (no extra deps).
 * Re-runs animation when the `tabKey` prop changes.
 */
const PageTransition = ({ tabKey, children }: { tabKey: string; children: ReactNode }) => {
  const [animKey, setAnimKey] = useState(tabKey);
  const prevKey = useRef(tabKey);

  useEffect(() => {
    if (prevKey.current !== tabKey) {
      prevKey.current = tabKey;
      setAnimKey(tabKey);
    }
  }, [tabKey]);

  return (
    <div key={animKey} className="page-transition">
      {children}
    </div>
  );
};

export default PageTransition;
