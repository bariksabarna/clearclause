/**
 * ClearClause wordmark — document sheet with a highlighter mark.
 */
export default function Logo({ className }) {
  return (
    <svg
      aria-label="ClearClause"
      role="img"
      viewBox="0 0 160 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g transform="translate(2, 4)">
        <rect
          x="2"
          y="2"
          width="22"
          height="26"
          rx="2"
          fill="#FFFFFF"
          stroke="#17223B"
          strokeWidth="1.8"
        />
        <path d="M6 9h14" stroke="#17223B" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="5" y="13.5" width="13" height="4.5" fill="#F5C518" fillOpacity="0.85" rx="0.5" />
        <path d="M6 15h11" stroke="#17223B" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M6 21h8" stroke="#17223B" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <text
        x="36"
        y="24"
        fontFamily="'IBM Plex Sans', sans-serif"
        fontSize="18"
        fontWeight="600"
        fill="#17223B"
        letterSpacing="-0.3"
      >
        ClearClause
      </text>
    </svg>
  );
}
