// Lightweight in-app event bus so the social feed and the workout-card thread
// stay in sync immediately, even if Supabase realtime is delayed or blocked.

const EVENT = "grim:post-interaction";

export const emitPostInteraction = (postId: string | null | undefined) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { postId: postId || null } }));
};

export const onPostInteraction = (
  handler: (postId: string | null) => void,
): (() => void) => {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const detail = (e as CustomEvent).detail as { postId: string | null } | undefined;
    handler(detail?.postId ?? null);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
};
