// Zysteel logo — red hexagonal ZY mark, replicates the brand asset.
interface Props { size?: number; className?: string; }

export function ZysteelLogo({ size = 36, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 90"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Zysteel logo"
    >
      {/* Hexagon background */}
      <polygon points="25,0 75,0 100,45 75,90 25,90 0,45" fill="#DC2626" />

      {/* Z letterform — white cutout */}
      {/* Top bar */}
      <rect x="18" y="22" width="32" height="10" fill="white" />
      {/* Diagonal stroke */}
      <polygon points="46,32 50,32 32,58 28,58" fill="white" />
      {/* Bottom bar */}
      <rect x="18" y="58" width="32" height="10" fill="white" />

      {/* Pixel / checker accent (top-right of Z) */}
      <rect x="46" y="14" width="7" height="7" fill="white" />
      <rect x="53" y="21" width="7" height="7" fill="white" />
      <rect x="60" y="14" width="7" height="7" fill="white" />
      <rect x="53" y="7"  width="7" height="7" fill="white" />

      {/* Y letterform — white */}
      {/* Left arm */}
      <polygon points="54,22 62,22 68,44 60,44" fill="white" />
      {/* Right arm */}
      <polygon points="76,22 84,22 72,44 64,44" fill="white" />
      {/* Stem */}
      <rect x="62" y="44" width="10" height="24" fill="white" />
    </svg>
  );
}
