interface Props {
  className?: string;
}

export function BrandMark({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        d="M14 8v20c0 8.2 5.8 14 14 14h7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="5"
      />
      <circle cx="39" cy="42" r="4.5" fill="var(--brand-dot, #d7ff55)" />
    </svg>
  );
}
