/**
 * Rendered garment art — the studio's stand-in for photography, drawn from the
 * dress's own palette (colorHex). The same silhouette the storefront will use,
 * so a piece reads the same on the rack and on the site.
 */
export function DressArt({ color, className }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 120 170" className={className} fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M40 28 L60 44 L80 28 L75 58 L73 70 C80 98 90 128 102 152 Q60 162 18 152 C30 128 40 98 47 70 L45 58 Z"
        fill={color}
        stroke="rgba(42, 35, 38, 0.16)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M47 70 Q60 77 73 70" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="2" strokeLinecap="round" />
      <path d="M58 80 C56 102 50 128 42 148" stroke="rgba(255, 255, 255, 0.22)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
