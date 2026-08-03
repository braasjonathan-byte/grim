/** Pastel gradient avatar styling derived from a name's first letter. */
export const avatarGradient = (name?: string | null) => {
  const initial = (name || "?").trim()[0]?.toUpperCase() || "?";
  const hue = (initial.charCodeAt(0) * 37) % 360;
  return {
    initial,
    style: {
      background: `linear-gradient(135deg, hsl(${hue} 70% 88%), hsl(${(hue + 40) % 360} 70% 78%))`,
    } as React.CSSProperties,
    textStyle: { color: `hsl(${hue} 60% 28%)` } as React.CSSProperties,
  };
};
