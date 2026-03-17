'use client';

// Full logo - Ghost with car inside
export function LogoFull({ className = 'w-12 h-12' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Water droplets */}
      <circle cx="82" cy="8" r="4" fill="currentColor" />
      <circle cx="88" cy="18" r="3" fill="currentColor" />

      {/* Main ghost/droplet body */}
      <path
        d="M50 5C50 5 70 5 78 25C86 45 82 60 78 72C82 76 88 82 88 90C88 98 78 100 70 95C65 105 58 115 50 115C42 115 35 105 30 95C22 100 12 98 12 90C12 82 18 76 22 72C18 60 14 45 22 25C30 5 50 5 50 5Z"
        fill="currentColor"
      />

      {/* Inner white space - ghost face area */}
      <path
        d="M50 20C38 20 28 30 28 42C28 54 35 58 35 58L30 75C35 72 42 70 50 70C58 70 65 72 70 75L65 58C65 58 72 54 72 42C72 30 62 20 50 20Z"
        fill="black"
      />

      {/* Robot visor */}
      <rect x="32" y="35" width="36" height="14" rx="7" fill="currentColor" />

      {/* Red eyes */}
      <circle cx="42" cy="42" r="5" fill="#ff3b3b" />
      <circle cx="58" cy="42" r="5" fill="#ff3b3b" />

      {/* Eye glints */}
      <circle cx="44" cy="40" r="1.5" fill="white" opacity="0.8" />
      <circle cx="60" cy="40" r="1.5" fill="white" opacity="0.8" />

      {/* Car body */}
      <path
        d="M30 80C30 80 35 72 50 72C65 72 70 80 70 80L65 88C65 88 60 85 50 85C40 85 35 88 35 88L30 80Z"
        fill="black"
      />

      {/* Car windshield */}
      <path
        d="M38 82C38 82 42 79 50 79C58 79 62 82 62 82L60 86C60 86 56 84 50 84C44 84 40 86 40 86L38 82Z"
        fill="currentColor"
      />

      {/* Car wheels */}
      <ellipse cx="38" cy="92" rx="5" ry="4" fill="black" />
      <ellipse cx="62" cy="92" rx="5" ry="4" fill="black" />
      <ellipse cx="38" cy="92" rx="2.5" ry="2" fill="currentColor" />
      <ellipse cx="62" cy="92" rx="2.5" ry="2" fill="currentColor" />
    </svg>
  );
}

// Compact "GW" logo
export function LogoCompact({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Water droplet */}
      <circle cx="88" cy="12" r="4" fill="currentColor" />

      {/* Main ghost/droplet body with splash */}
      <path
        d="M50 5C50 5 72 5 80 28C88 51 82 68 76 82C76 82 82 90 82 95C82 105 70 105 62 98C58 108 54 115 50 115C46 115 42 108 38 98C30 105 18 105 18 95C18 90 24 82 24 82C18 68 12 51 20 28C28 5 50 5 50 5Z"
        fill="currentColor"
      />

      {/* Splash detail at top */}
      <path
        d="M72 15C75 12 80 15 78 20C76 18 73 18 72 15Z"
        fill="currentColor"
      />

      {/* Inner white ghost face */}
      <ellipse cx="50" cy="45" rx="22" ry="20" fill="black" />

      {/* Robot visor */}
      <rect x="30" y="38" width="40" height="14" rx="7" fill="currentColor" />

      {/* Red eyes */}
      <circle cx="42" cy="45" r="5" fill="#ff3b3b" />
      <circle cx="58" cy="45" r="5" fill="#ff3b3b" />

      {/* Eye glints */}
      <circle cx="44" cy="43" r="1.5" fill="white" opacity="0.8" />
      <circle cx="60" cy="43" r="1.5" fill="white" opacity="0.8" />

      {/* GW Text */}
      <text
        x="50"
        y="88"
        textAnchor="middle"
        fill="black"
        fontSize="28"
        fontWeight="bold"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        GW
      </text>
    </svg>
  );
}

// Icon only (simplified for small sizes)
export function Logo({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Water droplet */}
      <circle cx="85" cy="10" r="4" fill="currentColor" />
      <circle cx="90" cy="20" r="2.5" fill="currentColor" />

      {/* Main ghost/droplet body */}
      <path
        d="M50 2C50 2 75 2 82 30C89 58 82 75 75 88C80 92 85 98 85 105C85 112 75 112 68 105C62 115 56 120 50 120C44 120 38 115 32 105C25 112 15 112 15 105C15 98 20 92 25 88C18 75 11 58 18 30C25 2 50 2 50 2Z"
        fill="currentColor"
      />

      {/* Splash at top */}
      <path
        d="M70 12C74 8 80 12 77 18L70 12Z"
        fill="currentColor"
      />

      {/* Inner white ghost face */}
      <path
        d="M50 22C36 22 25 34 25 48C25 62 34 68 34 68L28 88C36 84 43 82 50 82C57 82 64 84 72 88L66 68C66 68 75 62 75 48C75 34 64 22 50 22Z"
        fill="black"
      />

      {/* Robot visor */}
      <rect x="30" y="40" width="40" height="16" rx="8" fill="currentColor" />

      {/* Red eyes */}
      <circle cx="42" cy="48" r="6" fill="#ff3b3b" />
      <circle cx="58" cy="48" r="6" fill="#ff3b3b" />

      {/* Eye glints */}
      <circle cx="44" cy="46" r="2" fill="white" opacity="0.8" />
      <circle cx="60" cy="46" r="2" fill="white" opacity="0.8" />

      {/* Car silhouette */}
      <path
        d="M32 90C32 90 38 82 50 82C62 82 68 90 68 90L64 100C64 100 58 96 50 96C42 96 36 100 36 100L32 90Z"
        fill="black"
      />

      {/* Car windows */}
      <path
        d="M38 92C38 92 42 88 50 88C58 88 62 92 62 92L60 96C60 96 56 94 50 94C44 94 40 96 40 96L38 92Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Wordmark only
export function LogoWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`text-xl font-semibold tracking-tight ${className}`}>
      <span className="text-current">GhostWash</span>
      <span className="text-brand-red">.ai</span>
    </span>
  );
}

// Logo with wordmark (for nav)
export function LogoWithText({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Logo className="w-10 h-12 text-white" />
      <LogoWordmark />
    </div>
  );
}

// Dark version for light backgrounds
export function LogoDark({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Water droplet */}
      <circle cx="85" cy="10" r="4" fill="#1a1a1a" />
      <circle cx="90" cy="20" r="2.5" fill="#1a1a1a" />

      {/* Main ghost/droplet body */}
      <path
        d="M50 2C50 2 75 2 82 30C89 58 82 75 75 88C80 92 85 98 85 105C85 112 75 112 68 105C62 115 56 120 50 120C44 120 38 115 32 105C25 112 15 112 15 105C15 98 20 92 25 88C18 75 11 58 18 30C25 2 50 2 50 2Z"
        fill="#1a1a1a"
      />

      {/* Splash at top */}
      <path
        d="M70 12C74 8 80 12 77 18L70 12Z"
        fill="#1a1a1a"
      />

      {/* Inner white ghost face */}
      <path
        d="M50 22C36 22 25 34 25 48C25 62 34 68 34 68L28 88C36 84 43 82 50 82C57 82 64 84 72 88L66 68C66 68 75 62 75 48C75 34 64 22 50 22Z"
        fill="white"
      />

      {/* Robot visor */}
      <rect x="30" y="40" width="40" height="16" rx="8" fill="#1a1a1a" />

      {/* Red eyes */}
      <circle cx="42" cy="48" r="6" fill="#ff3b3b" />
      <circle cx="58" cy="48" r="6" fill="#ff3b3b" />

      {/* Eye glints */}
      <circle cx="44" cy="46" r="2" fill="white" opacity="0.8" />
      <circle cx="60" cy="46" r="2" fill="white" opacity="0.8" />

      {/* Car silhouette */}
      <path
        d="M32 90C32 90 38 82 50 82C62 82 68 90 68 90L64 100C64 100 58 96 50 96C42 96 36 100 36 100L32 90Z"
        fill="white"
      />

      {/* Car windows */}
      <path
        d="M38 92C38 92 42 88 50 88C58 88 62 92 62 92L60 96C60 96 56 94 50 94C44 94 40 96 40 96L38 92Z"
        fill="#1a1a1a"
      />
    </svg>
  );
}
