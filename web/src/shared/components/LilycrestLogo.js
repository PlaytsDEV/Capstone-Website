function LilycrestLogo() {
  return (
    <svg
      viewBox="0 0 120 120"
      width="80"
      height="80"
      xmlns="http://www.w3.org/2000/svg"
      className="lilycrest-logo"
    >
      {/* Outer diamond shape */}
      <g transform="translate(60, 60)">
        {/* Top triangle */}
        <polygon
          points="0,-45 32,-20 -32,-20"
          fill="none"
          stroke="#D4A574"
          strokeWidth="2"
        />

        {/* Right triangle */}
        <polygon
          points="32,-20 32,20 0,45"
          fill="none"
          stroke="#D4A574"
          strokeWidth="2"
        />

        {/* Bottom triangle */}
        <polygon
          points="0,45 -32,20 32,20"
          fill="none"
          stroke="#D4A574"
          strokeWidth="2"
        />

        {/* Left triangle */}
        <polygon
          points="-32,-20 0,-45 -32,20"
          fill="none"
          stroke="#D4A574"
          strokeWidth="2"
        />

        {/* Inner grid lines - horizontal */}
        <line x1="-32" y1="-20" x2="32" y2="-20" stroke="#D4A574" strokeWidth="2" />
        <line x1="-32" y1="0" x2="32" y2="0" stroke="#D4A574" strokeWidth="2" />
        <line x1="-32" y1="20" x2="32" y2="20" stroke="#D4A574" strokeWidth="2" />

        {/* Inner grid lines - vertical */}
        <line x1="-16" y1="-32.5" x2="0" y2="-45" stroke="#D4A574" strokeWidth="2" />
        <line x1="0" y1="-45" x2="16" y2="-32.5" stroke="#D4A574" strokeWidth="2" />

        <line x1="-32" y1="-10" x2="-16" y2="-20" stroke="#D4A574" strokeWidth="2" />
        <line x1="-32" y1="-10" x2="-16" y2="0" stroke="#D4A574" strokeWidth="2" />
        <line x1="-32" y1="10" x2="-16" y2="0" stroke="#D4A574" strokeWidth="2" />
        <line x1="-32" y1="10" x2="-16" y2="20" stroke="#D4A574" strokeWidth="2" />

        <line x1="0" y1="-45" x2="-16" y2="-32.5" stroke="#D4A574" strokeWidth="2" />
        <line x1="0" y1="-45" x2="16" y2="-32.5" stroke="#D4A574" strokeWidth="2" />

        <line x1="16" y1="-32.5" x2="32" y2="-20" stroke="#D4A574" strokeWidth="2" />
        <line x1="16" y1="-32.5" x2="16" y2="-10" stroke="#D4A574" strokeWidth="2" />

        <line x1="32" y1="-10" x2="16" y2="-20" stroke="#D4A574" strokeWidth="2" />
        <line x1="32" y1="-10" x2="16" y2="0" stroke="#D4A574" strokeWidth="2" />
        <line x1="32" y1="10" x2="16" y2="0" stroke="#D4A574" strokeWidth="2" />
        <line x1="32" y1="10" x2="16" y2="20" stroke="#D4A574" strokeWidth="2" />

        <line x1="16" y1="20" x2="0" y2="32.5" stroke="#D4A574" strokeWidth="2" />
        <line x1="16" y1="20" x2="16" y2="32.5" stroke="#D4A574" strokeWidth="2" />

        <line x1="0" y1="45" x2="-16" y2="32.5" stroke="#D4A574" strokeWidth="2" />
        <line x1="0" y1="45" x2="16" y2="32.5" stroke="#D4A574" strokeWidth="2" />

        <line x1="-16" y1="20" x2="0" y2="32.5" stroke="#D4A574" strokeWidth="2" />
        <line x1="-16" y1="20" x2="-16" y2="32.5" stroke="#D4A574" strokeWidth="2" />

        <line x1="-32" y1="-10" x2="-16" y2="0" stroke="#D4A574" strokeWidth="2" />
        <line x1="-32" y1="10" x2="-16" y2="0" stroke="#D4A574" strokeWidth="2" />
      </g>
    </svg>
  );
}

export default LilycrestLogo;
