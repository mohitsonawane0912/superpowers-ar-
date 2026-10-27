export type ShieldVariant = 'eldritch' | 'crimson' | 'emerald' | 'azure';

export function MagicalShield({ variant = 'eldritch', className = '' }: { variant?: ShieldVariant, className?: string }) {
  const configs = {
    eldritch: {
      color: '#ff8800',
      dropShadow: 'drop-shadow(0 0 15px rgba(255, 136, 0, 0.9))',
      innerGlow: '#ffcc00',
    },
    crimson: {
      color: '#ff2a2a',
      dropShadow: 'drop-shadow(0 0 20px rgba(255, 0, 0, 0.9))',
      innerGlow: '#ff0055',
    },
    emerald: {
      color: '#00ff66',
      dropShadow: 'drop-shadow(0 0 15px rgba(0, 255, 102, 0.9))',
      innerGlow: '#aaffcc',
    },
    azure: {
      color: '#00c3ff',
      dropShadow: 'drop-shadow(0 0 15px rgba(0, 195, 255, 0.9))',
      innerGlow: '#ccffff',
    }
  };

  const c = configs[variant];

  return (
    <div className={`relative flex items-center justify-center preserve-3d pointer-events-none select-none ${className}`}>
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full animate-pulse-glow preserve-3d"
        style={{
          color: c.color,
          filter: c.dropShadow,
          willChange: 'transform',
          overflow: 'visible'
        }}
      >
        {/* Layer 0 - Base Runes (Background, slightly set back) */}
        <g className="origin-center animate-[spin_20s_linear_infinite]" style={{ transform: 'translateZ(-20px)' }}>
          <circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.9" />
          <circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="10 5" opacity="0.6" />
          
          {/* Runes Outer */}
          {[...Array(24)].map((_, i) => (
            <text
              key={`runeO_${i}`}
              x="100"
              y="12"
              fill="currentColor"
              fontSize="10"
              fontFamily="serif"
              textAnchor="middle"
              transform={`rotate(${i * 15} 100 100)`}
              opacity="0.8"
            >
              {variant === 'eldritch' && [..."αβγδεζηθικλμ"][i % 12]}
              {variant === 'crimson' && [..."ΔΛΣΩΨΞΠΓΦΘΙΧ"][i % 12]}
              {variant === 'emerald' && [..."010110101100"][i % 12]}
              {variant === 'azure' && [..."✧✦✵✶✹✺✻✼✽✾✿❀"][i % 12]}
            </text>
          ))}
        </g>

        {/* Layer 1 - Reverse Slow (Middle Geometry) */}
        <g className="origin-center animate-spin-reverse-slow" style={{ transform: 'translateZ(10px)' }}>
          <circle cx="100" cy="100" r="75" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.8" />
          
          {/* Variant specific geometry */}
          {variant === 'eldritch' && (
            <>
              <circle cx="100" cy="100" r="68" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="40 10 5 10" />
              <polygon points="100,25 165,62.5 165,137.5 100,175 35,137.5 35,62.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <polygon points="100,25 165,137.5 35,137.5" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6" />
              <polygon points="100,175 35,62.5 165,62.5" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6" />
            </>
          )}

          {variant === 'crimson' && (
             <>
                <polygon points="100,10 120,70 190,50 140,110 180,180 100,140 20,180 60,110 10,50 80,70" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="5 5" />
             </>
          )}

          {variant === 'emerald' && (
            <>
              <rect x="35" y="35" width="130" height="130" fill="none" stroke="currentColor" strokeWidth="2" />
              <rect x="35" y="35" width="130" height="130" fill="none" stroke="currentColor" strokeWidth="2" transform="rotate(45 100 100)" />
              <circle cx="100" cy="100" r="68" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="15 15" />
            </>
          )}

           {variant === 'azure' && (
            <>
               {[...Array(6)].map((_, i) => (
                  <ellipse key={i} cx="100" cy="100" rx="75" ry="15" fill="none" stroke="currentColor" strokeWidth="2" transform={`rotate(${i * 30} 100 100)`} />
               ))}
            </>
          )}
        </g>

        {/* Layer 2 - Center Star / Runes (Foreground, floats slightly above) */}
        <g className="origin-center animate-[spin_8s_linear_infinite]" style={{ transform: 'translateZ(30px)' }}>
           <circle cx="100" cy="100" r="50" fill="none" stroke="currentColor" strokeWidth="2" />
           <circle cx="100" cy="100" r="45" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="5 5" />
           
           {(variant === 'eldritch' || variant === 'azure') && (
             <>
              <rect x="65" y="65" width="70" height="70" fill="none" stroke="currentColor" strokeWidth="2" transform="rotate(45 100 100)" />
              <rect x="65" y="65" width="70" height="70" fill="none" stroke="currentColor" strokeWidth="2" />
             </>
           )}

           {(variant === 'crimson' || variant === 'emerald') && (
             <polygon points="100,50 143,125 57,125" fill="none" stroke="currentColor" strokeWidth="3" />
           )}
           {(variant === 'crimson' || variant === 'emerald') && (
             <polygon points="100,150 57,75 143,75" fill="none" stroke="currentColor" strokeWidth="3" />
           )}

           {/* Runes Inner */}
           {[...Array(8)].map((_, i) => (
            <text
              key={`runeI_${i}`}
              x="100"
              y="60"
              fill="currentColor"
              fontSize="12"
              fontFamily="sans-serif"
              textAnchor="middle"
              transform={`rotate(${i * 45} 100 100)`}
              opacity="0.9"
            >
              {[..."✧✦✺✹✷✶✰✪"][i % 8]}
            </text>
          ))}
           
           {/* Center Glowing Orb */}
           <circle cx="100" cy="100" r="25" fill="none" stroke={c.innerGlow} strokeWidth="4" filter="blur(2px)" />
           <circle cx="100" cy="100" r="25" fill="none" stroke="currentColor" strokeWidth="2" />
           <circle cx="100" cy="100" r="12" fill="currentColor" opacity="0.8" filter="blur(3px)" />
           <circle cx="100" cy="100" r="5" fill="#fff" />
        </g>
      </svg>
    </div>
  );
}
