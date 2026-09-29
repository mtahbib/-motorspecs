/** Speedometer arc from the MotorSpecs logo, used as a large decorative graphic. */
export function GaugeArc({ className, tone = "brand" }: { className?: string; tone?: "brand" | "light" }) {
  const ticks = Array.from({ length: 9 }, (_, i) => {
    const start = 200 + i * 16;
    const end = start + 12;
    const r = 180;
    const toXY = (deg: number) => {
      const rad = (deg * Math.PI) / 180;
      return [200 + r * Math.cos(rad), 200 + r * Math.sin(rad)];
    };
    const [x1, y1] = toXY(start);
    const [x2, y2] = toXY(end);
    return { d: `M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)}`, hot: i >= 4 };
  });
  const cold = tone === "light" ? "#ffffff" : "#ffffff";
  const hot = tone === "light" ? "#ffffff" : "#003ffd";
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden fill="none">
      {ticks.map((t, i) => (
        <path key={i} d={t.d} stroke={t.hot ? hot : cold} strokeWidth={34} strokeLinecap="butt" opacity={t.hot ? 1 : 0.55} />
      ))}
      <path d="M150,250 L330,130 L170,275 Z" fill={hot} />
    </svg>
  );
}
