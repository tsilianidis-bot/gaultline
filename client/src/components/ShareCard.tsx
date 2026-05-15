/* ============================================================
   FAULTLINE — ShareCard Component
   Social-friendly snapshot for X, Instagram, LinkedIn.
   Generates a styled card with current regime, score, and
   probabilities. Uses navigator.share + clipboard fallback.
   ============================================================ */
import { useState } from "react";
import { Share2, Copy, Check, X } from "lucide-react";
import { useEngine } from "@/contexts/EngineContext";

interface ShareCardProps {
  onClose: () => void;
}

export default function ShareCard({ onClose }: ShareCardProps) {
  const { output, isLive } = useEngine();
  const { overall, regime, probability, analogs, narrative } = output;
  const [copied, setCopied] = useState(false);

  const topAnalog = analogs[0];
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const shareText = [
    `📊 FAULTLINE Macro Intelligence — ${date}`,
    ``,
    `Systemic Risk: ${overall.score.toFixed(1)}/10 — ${regime.label}`,
    `${regime.sublabel}`,
    ``,
    `Bull Probability: ${probability.bullProbability}%`,
    `Crash/Bear Probability: ${probability.crashProbability}%`,
    `Recession Risk: ${probability.recessionProbability}%`,
    ``,
    `Closest Historical Analog: ${topAnalog.era} ${topAnalog.year} (${topAnalog.similarity}% match)`,
    ``,
    `${narrative.summary.slice(0, 200)}...`,
    ``,
    `${isLive ? '📡 Powered by live FRED macroeconomic data' : '📊 Powered by calibrated macro baseline'}`,
    `⚠️ Probabilistic risk intelligence. Not financial advice.`,
  ].join('\n');

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'FAULTLINE Macro Intelligence', text: shareText });
      } catch {
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const scoreColor = overall.score >= 8.5 ? '#FF2D55' : overall.score >= 7 ? '#FF9500' : overall.score >= 5 ? '#FFD700' : '#00D4FF';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
      background: 'rgba(5,6,8,0.9)',
      backdropFilter: 'blur(12px)',
      animation: 'fade-in 0.2s ease both',
    }}>
      <div style={{
        width: '100%', maxWidth: '380px',
        animation: 'share-pop 0.35s cubic-bezier(0.23,1,0.32,1) both',
      }}>
        {/* Close */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '50%', width: '32px', height: '32px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#6B7280', minHeight: 'unset',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Preview card — styled like a social post */}
        <div style={{
          background: 'linear-gradient(135deg, #0A0C10 0%, #0F1117 100%)',
          border: `1px solid ${scoreColor}30`,
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '12px',
          boxShadow: `0 0 40px ${scoreColor}15, 0 20px 60px rgba(0,0,0,0.6)`,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Background glow */}
          <div style={{
            position: 'absolute', top: '-40px', right: '-40px',
            width: '160px', height: '160px',
            background: `radial-gradient(circle, ${scoreColor}08 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{
              width: '24px', height: '24px',
              background: 'linear-gradient(135deg, #00D4FF, #0066FF)',
              borderRadius: '4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 12px rgba(0,212,255,0.4)',
            }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M2 8 L6 4 L10 9 L14 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '14px', color: '#F0F4FF', letterSpacing: '0.1em' }}>FAULTLINE</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.1em' }}>MACRO INTELLIGENCE · {date}</div>
            </div>
            {isLive && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '2px' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#00FF88', animation: 'pulse-gold 2s ease-in-out infinite' }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#00FF88', letterSpacing: '0.1em' }}>LIVE</span>
              </div>
            )}
          </div>

          {/* Score + Regime */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '40px', color: scoreColor, textShadow: `0 0 24px ${scoreColor}60`, lineHeight: 1 }}>
                {overall.score.toFixed(1)}
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#6B7280' }}>/10</span>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: scoreColor, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              {regime.label}
            </div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
              {regime.sublabel}
            </div>
          </div>

          {/* Probability bar */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#00FF88' }}>{probability.bullProbability}% BULL</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#FF2D55' }}>{probability.crashProbability}% CRASH</span>
            </div>
            <div style={{ height: '4px', borderRadius: '2px', overflow: 'hidden', display: 'flex', gap: '1px' }}>
              <div style={{ flex: probability.bullProbability, background: 'linear-gradient(90deg, #00FF88, #00CC6A)', boxShadow: '0 0 6px rgba(0,255,136,0.4)' }} />
              <div style={{ flex: probability.crashProbability, background: 'linear-gradient(90deg, #FF9500, #FF2D55)', boxShadow: '0 0 6px rgba(255,45,85,0.4)' }} />
            </div>
          </div>

          {/* Key metrics row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '14px' }}>
            {[
              { label: 'Recession', value: `${probability.recessionProbability}%`, color: '#FF9500' },
              { label: 'Stagflation', value: `${probability.stagflationProbability}%`, color: '#FFD700' },
              { label: 'Soft Land', value: `${probability.softLandingProbability}%`, color: '#00D4FF' },
            ].map(m => (
              <div key={m.label} style={{ textAlign: 'center', padding: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '16px', color: m.color }}>{m.value}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</div>
              </div>
            ))}
          </div>

          {/* Analog */}
          <div style={{ padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>Closest Historical Analog</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '12px', color: '#D1D5DB' }}>{topAnalog.era} {topAnalog.year}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#00D4FF' }}>{topAnalog.similarity}%</span>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#374151', letterSpacing: '0.08em' }}>
              PROBABILISTIC RISK INTELLIGENCE
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#374151', letterSpacing: '0.08em' }}>
              NOT FINANCIAL ADVICE
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleShare}
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              padding: '12px',
              background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.08))',
              border: '1px solid rgba(0,212,255,0.3)',
              borderRadius: '6px',
              color: '#00D4FF',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(0,212,255,0.1)',
              minHeight: '48px',
            }}
          >
            <Share2 size={14} />
            Share
          </button>
          <button
            onClick={copyToClipboard}
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              padding: '12px',
              background: copied ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${copied ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '6px',
              color: copied ? '#00FF88' : '#94A3B8',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              minHeight: '48px',
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151', marginTop: '10px', letterSpacing: '0.08em' }}>
          Share on X · LinkedIn · Instagram Stories
        </p>
      </div>
    </div>
  );
}
