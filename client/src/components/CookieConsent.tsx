/* ============================================================
   FAULTLINE — GDPR Cookie Consent Banner
   Persists user choice in localStorage.
   Shows on first visit; hides permanently after accept/decline.
   ============================================================ */
import { useState, useEffect } from 'react';
import { Link } from 'wouter';

const STORAGE_KEY = 'faultline_cookie_consent';

export type ConsentChoice = 'accepted' | 'declined' | null;

export function getConsentChoice(): ConsentChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'accepted' || v === 'declined') return v;
  } catch {}
  return null;
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Slight delay so it doesn't flash immediately on load
    const timer = setTimeout(() => {
      if (getConsentChoice() === null) setVisible(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  function handleAccept() {
    try { localStorage.setItem(STORAGE_KEY, 'accepted'); } catch {}
    setVisible(false);
  }

  function handleDecline() {
    try { localStorage.setItem(STORAGE_KEY, 'declined'); } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 'min(560px, calc(100vw - 24px))',
        background: 'rgba(10,12,16,0.97)',
        border: '1px solid rgba(0,212,255,0.18)',
        borderRadius: '8px',
        padding: '14px 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.06)',
        animation: 'fade-slide-up 0.35s cubic-bezier(0.23,1,0.32,1) both',
        backdropFilter: 'blur(12px)',
        boxSizing: 'border-box',
      }}
    >
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)',
        borderRadius: '8px 8px 0 0',
      }} />

      {/* Icon + text row — stacks on very narrow screens */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
        {/* Icon */}
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
          background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginTop: '1px',
        }}>
          <span style={{ fontSize: '13px' }}>🍪</span>
        </div>

        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
            color: '#00D4FF', letterSpacing: '0.12em', textTransform: 'uppercase',
            marginBottom: '4px',
          }}>
            COOKIES &amp; ANALYTICS
          </div>
          <p style={{
            fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px',
            color: '#9CA3AF', lineHeight: 1.55, margin: '0 0 10px',
            wordBreak: 'break-word',
          }}>
            FAULTLINE uses analytics cookies to understand how the platform is used and improve the experience.
            No personal data is sold or shared with third parties.{' '}
            <Link href="/legal" style={{ color: '#00D4FF', textDecoration: 'none', borderBottom: '1px solid rgba(0,212,255,0.3)' }}>
              Privacy Policy
            </Link>
          </p>

          {/* Buttons — wrap to next line on narrow screens */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={handleAccept}
              style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                letterSpacing: '0.08em', padding: '8px 18px',
                background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.35)',
                borderRadius: '4px', color: '#00D4FF', cursor: 'pointer',
                transition: 'all 0.15s ease', flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.12)')}
            >
              ACCEPT ALL
            </button>
            <button
              onClick={handleDecline}
              style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                letterSpacing: '0.08em', padding: '8px 18px',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px', color: '#6B7280', cursor: 'pointer',
                transition: 'all 0.15s ease', flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
            >
              DECLINE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
