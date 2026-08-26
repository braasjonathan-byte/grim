import type { ReactNode, TouchEvent } from "react";
import { createPortal } from "react-dom";
import { COMPOSER_BOTTOM } from "@/hooks/useChatComposerBottom";

interface ChatComposerPortalProps {
  children: ReactNode;
  className?: string;
  onTouchMove?: (event: TouchEvent<HTMLDivElement>) => void;
}

/**
 * Renders chat controls directly under document.body so animated/scrolling tab
 * wrappers can never become the containing block for the fixed composer.
 */
const ChatComposerPortal = ({ children, className = "", onTouchMove }: ChatComposerPortalProps) => {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed left-0 right-0 z-40 mx-auto max-w-lg bg-background border-t border-border ${className}`}
      style={{ bottom: COMPOSER_BOTTOM, touchAction: "none", transition: "bottom 140ms ease-out" }}
      onTouchMove={onTouchMove}
    >
      {children}
    </div>,
    document.body,
  );
};

export default ChatComposerPortal;