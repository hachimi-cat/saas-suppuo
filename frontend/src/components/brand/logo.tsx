// Suppuo logomark — a speech bubble carrying a lifebuoy ring: support
// conversations with a rescue ring at the center. currentColor so it
// follows the DO-blue primary (or white on blue surfaces).

interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 24, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* speech bubble */}
      <path
        d="M12 3C7 3 3 6.6 3 11c0 2.4 1.2 4.5 3.1 6L5.4 20.6a.7.7 0 0 0 1 .8l3.9-2.1c.55.1 1.1.2 1.7.2 5 0 9-3.6 9-8.5S17 3 12 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* lifebuoy ring */}
      <circle cx="12" cy="11" r="3.4" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="11" r="1" fill="currentColor" />
    </svg>
  );
}
