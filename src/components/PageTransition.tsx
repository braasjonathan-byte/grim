import { ReactNode } from "react";

const PageTransition = ({ tabKey, children }: { tabKey: string; children: ReactNode }) => {
  return (
    <div data-tab-key={tabKey}>
      {children}
    </div>
  );
};

export default PageTransition;
