import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'GhostWash - AI-Powered Car Wash Member Retention';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'black',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Logo */}
        <svg
          width="120"
          height="144"
          viewBox="0 0 100 120"
          fill="none"
          style={{ marginBottom: 40 }}
        >
          {/* Water droplet */}
          <circle cx="85" cy="10" r="4" fill="white" />
          <circle cx="90" cy="20" r="2.5" fill="white" />

          {/* Main ghost/droplet body */}
          <path
            d="M50 2C50 2 75 2 82 30C89 58 82 75 75 88C80 92 85 98 85 105C85 112 75 112 68 105C62 115 56 120 50 120C44 120 38 115 32 105C25 112 15 112 15 105C15 98 20 92 25 88C18 75 11 58 18 30C25 2 50 2 50 2Z"
            fill="white"
          />

          {/* Splash at top */}
          <path
            d="M70 12C74 8 80 12 77 18L70 12Z"
            fill="white"
          />

          {/* Inner ghost face */}
          <path
            d="M50 22C36 22 25 34 25 48C25 62 34 68 34 68L28 88C36 84 43 82 50 82C57 82 64 84 72 88L66 68C66 68 75 62 75 48C75 34 64 22 50 22Z"
            fill="black"
          />

          {/* Robot visor */}
          <rect x="30" y="40" width="40" height="16" rx="8" fill="white" />

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
            fill="white"
          />
        </svg>

        {/* Text */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 600,
              color: 'white',
              letterSpacing: '-0.02em',
            }}
          >
            GhostWash
          </div>
          <div
            style={{
              fontSize: 28,
              color: 'rgba(255,255,255,0.5)',
              marginTop: 16,
            }}
          >
            Your car wash runs itself now.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
