/* ============================================================
   FAULTLINE — GDPR Cookie Consent Banner
   Compact, bottom-edge, non-obstructive.
   Desktop: thin horizontal bar pinned to the bottom edge.
   Mobile: compact bottom-sheet that never covers CTAs.
   Persists user choice in localStorage.
   Shows on first visit; hides permanently after accept/decline.
   ============================================================ */
import { useState, useEffect } from 'react';
import { Link } from 'wouter';

const STORAGE_KEY = 'faultline_cookie_consent_v2';

export type ConsentChoice = 'accepted' | 'declined' | null;

export function getConsentChoice(): ConsentChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'accepted' || v === 'declined') return v;
    // Migrate from old key
    const old = localStorage.getItem('faultline_cookie_consent');
    if (old === 'accepted' || old === 'declined') {
      localStorage.setItem(STORAGE_KEY, old);
      return old;
    }
  } catch {}
  return null;
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (getConsentChoice() === null) setVisible(true);
    }, 1500);
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
    <>
      <style>{`
        @keyframes cookie-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
      <div
        role="dialog"
        aria-label="Cookie consent"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'rgba(8,10,16,0.97)',
          borderTop: '1px solid rgba(0,212,255,0.14)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          animation: 'cookie-slide-up 0.3s cubic-bezier(0.23,1,0.32,1) both',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
        }}
      >
        {/* Top accent line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.35) 30%, rgba(0,212,255,0.35) 70%, transparent 100%)',
        }} />

        {/* Inner layout — horizontal on desktop, stacked on mobile */}
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}>
          {/* Icon */}
          <div style={{
            width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
            background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '11px' }}>🍪</span>
          </div>

          {/* Text */}
          <p style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: '12px',
            color: '#94A3B8',
            lineHeight: 1.5,
            margin: 0,
            flex: '1 1 260px',
            minWidth: 0,
          }}>
            FAULTLINE uses analytics cookies to understand platform usage and improve the experience. No personal data is sold.{' '}
            <Link href="/legal" style={{ color: '#00D4FF', textDecoration: 'none', borderBottom: '1px solid rgba(0,212,255,0.3)' }}>
              Privacy Policy
            </Link>
          </p>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
            <button
              onClick={handleAccept}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.08em',
                padding: '7px 16px',
                background: 'rgba(0,212,255,0.12)',
                border: '1px solid rgba(0,212,255,0.35)',
                borderRadius: '4px',
                color: '#00D4FF',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.22)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.12)')}
            >
              ACCEPT ALL
            </button>
            <button
              onClick={handleDecline}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.08em',
                padding: '7px 16px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px',
                color: '#6B7280',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
            >
              DECLINE
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
