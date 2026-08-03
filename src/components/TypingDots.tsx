interface TypingDotsProps {
  label?: string;
  className?: string;
}

/** Small animated "typing…" indicator. */
const TypingDots = ({ label = "skriver", className = "" }: TypingDotsProps) => (
  <span className={`inline-flex items-center gap-1 text-primary ${className}`}>
    <span>{label}</span>
    <span className="inline-flex items-center gap-0.5">
      {[0, 150, 300].map(delay => (
        <span
          key={delay}
          className="h-1 w-1 rounded-full bg-primary animate-bounce"
          style={{ animationDelay: `${delay}ms`, animationDuration: "900ms" }}
        />
      ))}
    </span>
  </span>
);

export default TypingDots;
