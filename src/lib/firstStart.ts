export type FirstFocus = "training" | "nutrition" | "both";
const key = (userId: string) => `grim:first-focus:${userId}`;

export function getFirstFocus(userId: string): FirstFocus | null {
  try {
    const value = localStorage.getItem(key(userId));
    return value === "training" || value === "nutrition" || value === "both" ? value : null;
  } catch { return null; }
}

/** Focus only prioritizes the first task; it never disables modules or needs body data. */
export function saveFirstFocus(userId: string, focus: FirstFocus) {
  localStorage.setItem(key(userId), focus);
}

export function firstTask(focus: FirstFocus): "workout" | "nutrition" {
  return focus === "nutrition" ? "nutrition" : "workout";
}