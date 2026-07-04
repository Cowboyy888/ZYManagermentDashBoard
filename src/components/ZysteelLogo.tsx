// ZY Steel brand logo — accurate SVG recreation of the red hexagonal ZY mark
interface Props { size?: number; className?: string; }

export function ZysteelLogo({ size = 36, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size * 0.87}
      viewBox="0 0 120 104"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Zysteel logo"
      role="img"
    >
      {/* ── Outer hexagonal box shape ── */}
      {/*
        The shape is a wide flat hexagon resembling a 3D box face:
          top-left slope → top flat → right slope → bottom-right slope → bottom flat → left slope
      */}
      <polygon
        points="
          8,52
          32,8
          72,8
          112,52
          88,96
          28,96
        "
        fill="#DC2626"
      />

      {/* ── Z letterform (white cutouts) ── */}
      {/* Top bar */}
      <rect x="16" y="26" width="36" height="10" rx="1" fill="white" />
      {/* Diagonal stroke */}
      <polygon points="48,36 52,36 30,68 26,68" fill="white" />
      {/* Bottom bar */}
      <rect x="16" y="68" width="36" height="10" rx="1" fill="white" />

      {/* ── Checker / pixel accent (top-right of Z / between letters) ── */}
      {/* Row 1: 2 squares */}
      <rect x="52" y="18" width="7" height="7" fill="white" />
      <rect x="66" y="18" width="7" height="7" fill="white" />
      {/* Row 2: 2 squares (offset) */}
      <rect x="59" y="25" width="7" height="7" fill="white" />
      <rect x="73" y="25" width="7" height="7" fill="white" />
      {/* Row 3: 1 square */}
      <rect x="52" y="32" width="7" height="7" fill="white" />
      <rect x="66" y="32" width="7" height="7" fill="white" />

      {/* ── Y letterform (white) ── */}
      {/* Left arm of Y */}
      <polygon points="62,26 71,26 76,50 67,50" fill="white" />
      {/* Right arm of Y */}
      <polygon points="87,26 96,26 81,50 72,50" fill="white" />
      {/* Stem of Y */}
      <rect x="70" y="50" width="10" height="28" rx="1" fill="white" />
    </svg>
  );
}
