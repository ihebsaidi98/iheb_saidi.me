export function StatusDot({
  size = 8,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const px = `${size}px`;

  return (
    <span className={`relative inline-flex ${className}`} style={{ width: px, height: px }}>
      <span
        aria-hidden
        className="absolute inline-flex animate-ping rounded-full bg-emerald-400 opacity-60"
        style={{ width: px, height: px }}
      />
      <span
        aria-hidden
        className="relative inline-flex rounded-full bg-emerald-400"
        style={{ width: px, height: px }}
      />
    </span>
  );
}
