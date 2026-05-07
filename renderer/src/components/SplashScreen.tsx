import { useEffect, useState } from 'react'

const LETTERS = ['F', 'O', 'R', 'G', 'E']
const LETTER_DELAY = 120 // ms between each letter
const ICON_DELAY = LETTERS.length * LETTER_DELAY + 200
const HOLD_DELAY = ICON_DELAY + 600
const FADE_DURATION = 600

interface Props {
  onDone: () => void
}

export default function SplashScreen({ onDone }: Props) {
  const [visibleLetters, setVisibleLetters] = useState<number>(-1)
  const [iconVisible, setIconVisible] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    // Stagger each letter
    LETTERS.forEach((_, i) => {
      setTimeout(() => setVisibleLetters(i), i * LETTER_DELAY + 200)
    })
    // Icon slides in
    setTimeout(() => setIconVisible(true), ICON_DELAY + 200)
    // Hold then fade out
    setTimeout(() => setFadeOut(true), HOLD_DELAY + 400)
    // Unmount after fade
    setTimeout(() => onDone(), HOLD_DELAY + 400 + FADE_DURATION)
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0f0e0d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeOut ? 0 : 1,
        transition: `opacity ${FADE_DURATION}ms cubic-bezier(0.16,1,0.3,1)`,
        pointerEvents: fadeOut ? 'none' : 'all',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '18px',
        userSelect: 'none',
      }}>

        {/* ── Icon ── */}
        <div style={{
          opacity: iconVisible ? 1 : 0,
          transform: iconVisible ? 'translateX(0) scale(1)' : 'translateX(-18px) scale(0.85)',
          transition: 'opacity 500ms cubic-bezier(0.16,1,0.3,1), transform 500ms cubic-bezier(0.16,1,0.3,1)',
        }}>
          <img
            src="/logoforforge.png"
            alt="Forge logo"
            width={56}
            height={56}
            style={{ objectFit: 'contain' }}
          />
        </div>

        {/* ── Letters ── */}
        <div style={{
          display: 'flex',
          gap: '2px',
          alignItems: 'baseline',
        }}>
          {LETTERS.map((letter, i) => (
            <span
              key={letter}
              style={{
                fontFamily: "'Satoshi', system-ui, sans-serif",
                fontSize: '52px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1,
                // Gradient: steel grey → teal, left to right
                background: `linear-gradient(135deg,
                  #c8c6c2 ${i * 20}%,
                  #4f98a3 ${50 + i * 10}%,
                  #4f98a3 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                opacity: visibleLetters >= i ? 1 : 0,
                transform: visibleLetters >= i ? 'translateY(0)' : 'translateY(14px)',
                transition: 'opacity 350ms cubic-bezier(0.16,1,0.3,1), transform 350ms cubic-bezier(0.16,1,0.3,1)',
                display: 'inline-block',
              }}
            >
              {letter}
            </span>
          ))}
        </div>
      </div>

      {/* Subtle glow behind the logo */}
      <div style={{
        position: 'absolute',
        width: '320px',
        height: '120px',
        background: 'radial-gradient(ellipse at center, rgba(79,152,163,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
        opacity: iconVisible ? 1 : 0,
        transition: 'opacity 800ms ease',
      }} />
    </div>
  )
}

// ── Inline SVG icon — premium flame + hammer + code brackets ───────────────
function ForgeIcon({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Forge icon"
    >
      <defs>
        {/* Teal flame gradient — light cyan top to deep teal bottom */}
        <linearGradient id="flame-grad" x1="24" y1="4" x2="24" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8ff0fa" stopOpacity="1"/>
          <stop offset="45%" stopColor="#3dbdcc" stopOpacity="0.97"/>
          <stop offset="100%" stopColor="#145e68" stopOpacity="0.75"/>
        </linearGradient>
        {/* Steel gradient — bright silver to dark gunmetal */}
        <linearGradient id="steel-grad" x1="24" y1="14" x2="24" y2="41" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e2e0dd"/>
          <stop offset="45%" stopColor="#b0adaa"/>
          <stop offset="100%" stopColor="#636160"/>
        </linearGradient>
        {/* Subtle glow for flames and brackets */}
        <filter id="fl-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        {/* Inner shadow for hammer depth */}
        <filter id="hammer-depth" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#000" floodOpacity="0.35"/>
        </filter>
      </defs>

      {/* ── Flame left — sweeping teal curve ── */}
      <path
        d="M15 41 C5 29 9 15 20 9 C16 19 21 25 23 20 C16 27 19 35 15 41Z"
        fill="url(#flame-grad)"
        opacity="0.94"
        filter="url(#fl-glow)"
      />
      {/* ── Flame right — mirror sweep ── */}
      <path
        d="M33 41 C43 29 39 15 28 9 C32 19 27 25 25 20 C32 27 29 35 33 41Z"
        fill="url(#flame-grad)"
        opacity="0.94"
        filter="url(#fl-glow)"
      />

      {/* ── Hammer handle ── */}
      <rect x="21" y="27" width="6" height="14" rx="3" fill="url(#steel-grad)" filter="url(#hammer-depth)"/>
      {/* Handle top highlight */}
      <rect x="21" y="27" width="6" height="3.5" rx="2.5" fill="rgba(255,255,255,0.22)"/>

      {/* ── Hammer head ── */}
      <rect x="13" y="15" width="22" height="14" rx="3.5" fill="url(#steel-grad)" filter="url(#hammer-depth)"/>
      {/* Head top bevel highlight */}
      <rect x="13" y="15" width="22" height="5" rx="3.5" fill="rgba(255,255,255,0.22)"/>
      {/* Head bottom inner shadow */}
      <rect x="13" y="24" width="22" height="5" rx="0" fill="rgba(0,0,0,0.18)"/>
      {/* Head left edge highlight */}
      <rect x="13" y="15" width="3" height="14" rx="2" fill="rgba(255,255,255,0.1)"/>

      {/* ── Code brackets < > ── */}
      <text
        x="24"
        y="47"
        textAnchor="middle"
        fontSize="7.5"
        fontFamily="monospace"
        fontWeight="bold"
        fill="#4fc9d4"
        opacity="0.9"
        filter="url(#fl-glow)"
      >
        {'< >'}
      </text>
    </svg>
  )
}
