type Props = {
  size?: number;
  className?: string;
  withDot?: boolean;
};

export function LogoMark({ size = 18, className, withDot = true }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Antibody"
      role="img"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="6" y1="7" x2="11" y2="7" />
        <line x1="21" y1="7" x2="26" y2="7" />
        <line x1="8.5" y1="7" x2="16" y2="16" />
        <line x1="23.5" y1="7" x2="16" y2="16" />
        <line x1="16" y1="16" x2="16" y2="26" />
      </g>
      {withDot ? <circle cx="16" cy="27.6" r="1.4" fill="#1D9E75" /> : null}
    </svg>
  );
}
