export function RobotIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 170" className={className} fill="none" aria-hidden>
      <ellipse cx="100" cy="158" rx="58" ry="7" fill="rgb(var(--primary) / 0.10)" />
      <line x1="100" y1="22" x2="100" y2="40" stroke="rgb(var(--secondary))" strokeWidth="4" strokeLinecap="round" />
      <circle cx="100" cy="17" r="7" fill="rgb(var(--secondary))">
        <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
      </circle>
      <rect x="48" y="40" width="104" height="78" rx="26" fill="white" stroke="rgb(var(--primary))" strokeWidth="4" />
      <rect x="62" y="56" width="76" height="40" rx="16" fill="rgb(var(--primary) / 0.10)" />
      <circle cx="84" cy="76" r="7" fill="rgb(var(--primary))">
        <animate attributeName="r" values="7;7;1;7" keyTimes="0;0.9;0.95;1" dur="4s" repeatCount="indefinite" />
      </circle>
      <circle cx="116" cy="76" r="7" fill="rgb(var(--primary))">
        <animate attributeName="r" values="7;7;1;7" keyTimes="0;0.9;0.95;1" dur="4s" repeatCount="indefinite" />
      </circle>
      <path d="M88 104 q12 8 24 0" stroke="rgb(var(--secondary))" strokeWidth="4" strokeLinecap="round" />
      <rect x="36" y="66" width="12" height="26" rx="6" fill="rgb(var(--secondary))" />
      <rect x="152" y="66" width="12" height="26" rx="6" fill="rgb(var(--secondary))" />
      <rect x="72" y="118" width="56" height="30" rx="12" fill="rgb(var(--primary))" />
      <path d="M158 30 l4 -10 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 z" fill="rgb(var(--secondary) / 0.7)" />
      <path d="M30 40 l3 -7 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 z" fill="rgb(var(--primary) / 0.5)" />
    </svg>
  );
}
