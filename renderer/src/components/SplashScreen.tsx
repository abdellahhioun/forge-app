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
        gap: '24px',
        userSelect: 'none',
      }}>

        {/* ── Icon ── */}
        <div style={{
          opacity: iconVisible ? 1 : 0,
          transform: iconVisible ? 'translateX(0) scale(1)' : 'translateX(-18px) scale(0.85)',
          transition: 'opacity 500ms cubic-bezier(0.16,1,0.3,1), transform 500ms cubic-bezier(0.16,1,0.3,1)',
        }}>
          <img
            src="./logoforforge.png"
            alt="Forge logo"
            width={120}
            height={120}
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
