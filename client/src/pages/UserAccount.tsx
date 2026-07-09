/* ============================================================
   FAULTLINE — User Account & Access Tier Dashboard
   Shows user profile, current access tier, tier benefits,
   and founding access request form.
   ============================================================ */
import { useState, useEffect } from 'react';
import { Shield, Zap, Crown, User, Mail, Clock, LogOut, ChevronRight, Lock, CheckCircle, Send, AlertCircle, CreditCard, Share2, Eye, Trash2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { getLoginUrl } from '@/const';
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import { toast } from 'sonner';
import { useSearch } from 'wouter';
import { TIER_META, PRICING_PLANS, type AccessTier } from '../../../shared/tiers';

// Icon map for tiers (React nodes cannot live in shared/)
const TIER_ICONS: Record<AccessTier, React.ReactNode> = {
  free:     <User size={18} />,
  core:     <Zap size={18} />,
  premium:  <Zap size={18} />,
  founding: <Crown size={18} />,
};

// ── Tier config ────────────────────────────────────────────────
const TIER_CONFIG = {
  core: {
    label: 'TRADER',
    sublabel: 'Mobile-first Market Intelligence',
    color: '#22D3EE',
    glow: 'rgba(34,211,238,0.2)',
    border: 'rgba(34,211,238,0.3)',
    icon: <Zap size={18} />,
    description: 'Fast, intelligent, connected. Built for traders who want institutional signals without the institutional price.',
    features: [
      { label: 'Unlimited stock signals (BUY/SELL/HOLD)', available: true },
      { label: 'Unlimited crypto signals', available: true },
      { label: 'Portfolio tracker with live P&L', available: true },
      { label: 'Alt Rotation tracking', available: true },
      { label: 'Daily market briefings', available: true },
      { label: 'Volatility monitoring & push alerts', available: true },
      { label: 'Unlimited Watchlist', available: true },
      { label: 'Aftershock alerts', available: true },
    ],
  },
  free: {
    label: 'OBSERVER',
    sublabel: 'Free Intelligence',
    color: '#6B7280',
    glow: 'rgba(107,114,128,0.2)',
    border: 'rgba(107,114,128,0.3)',
    icon: <User size={18} />,
    description: 'Start monitoring systemic pressure. Discover what institutional intelligence feels like.',
    features: [
      { label: 'FAULTLINE Pressure Index™ (delayed 24h)', available: true },
      { label: 'Limited stock intelligence previews', available: true },
      { label: 'Limited crypto signal previews', available: true },
      { label: 'Daily macro snapshot', available: true },
      { label: '1 watchlist ticker', available: true },
      { label: 'Full signals screener', available: false },
      { label: 'Portfolio tracker', available: false },
      { label: 'AI intelligence engines', available: false },
    ],
  },
  premium: {
    label: 'POWER',
    sublabel: 'Institutional-grade Intelligence',
    color: '#00D4FF',
    glow: 'rgba(0,212,255,0.2)',
    border: 'rgba(0,212,255,0.35)',
    icon: <Zap size={18} />,
    description: 'The complete intelligence suite. Every engine, every signal, every edge — fully unlocked.',
    features: [
      { label: 'Everything in Pro', available: true },
      { label: 'AI Diagnostic Intelligence™', available: true },
      { label: 'Full crypto intelligence engine', available: true },
      { label: 'Advanced Aftershock Engine™', available: true },
      { label: 'Full systemic risk analytics', available: true },
      { label: 'Macro regime analysis', available: true },
      { label: 'Advanced watchlists & alerts', available: true },
      { label: 'Historical analog engine', available: true },
    ],
  },
  founding: {
    label: 'FOUNDING',
    sublabel: 'Rate Locked for Life',
    color: '#FFD700',
    glow: 'rgba(255,215,0,0.2)',
    border: 'rgba(255,215,0,0.4)',
    icon: <Crown size={18} />,
    description: 'Everything in Pro at the founding rate. Locked forever. Never increases. Limited cohort.',
    features: [
      { label: 'Everything in Pro', available: true },
      { label: 'Permanent founding rate ($49/mo locked)', available: true },
      { label: 'Founding member badge', available: true },
      { label: 'Future feature grandfathering', available: true },
      { label: 'Roadmap previews & early beta', available: true },
      { label: 'Priority feature access', available: true },
      { label: 'Exclusive founder-only tools', available: true },
      { label: 'Direct feedback channel', available: true },
    ],
  },
};

// ── Tier Badge ─────────────────────────────────────────────────
function TierBadge({ tier }: { tier: 'free' | 'core' | 'premium' | 'founding' }) {
  const cfg = TIER_CONFIG[tier];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '5px 12px',
      background: cfg.glow,
      border: `1px solid ${cfg.border}`,
      borderRadius: '20px',
      color: cfg.color,
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: '11px',
      letterSpacing: '0.12em',
      fontWeight: 600,
    }}>
      {cfg.icon}
      {cfg.label}
    </div>
  );
}

// ── Founding Access Request Form ───────────────────────────────
function FoundingAccessForm({ userEmail }: { userEmail?: string | null }) {
  const [email, setEmail] = useState(userEmail ?? '');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const requestMutation = trpc.user.requestFoundingAccess.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  if (submitted) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
        padding: '32px 24px', textAlign: 'center',
        background: 'rgba(0,255,136,0.05)',
        border: '1px solid rgba(0,255,136,0.2)',
        borderRadius: '12px',
      }}>
        <CheckCircle size={32} style={{ color: '#00FF88' }} />
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: '#00FF88', letterSpacing: '0.1em' }}>
          REQUEST SUBMITTED
        </div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#9CA3AF', maxWidth: '320px', lineHeight: 1.6 }}>
          Your founding access request has been received. We review applications manually and will contact you at <strong style={{ color: '#E2E8F0' }}>{email}</strong>.
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        if (!email) return;
        requestMutation.mutate({ email, name: name || undefined, message: message || undefined });
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
    >
      <div>
        <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', letterSpacing: '0.15em', display: 'block', marginBottom: '6px' }}>
          EMAIL ADDRESS *
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          style={{
            width: '100%', padding: '10px 14px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#E2E8F0',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '12px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          onFocus={e => (e.target.style.borderColor = 'rgba(0,212,255,0.4)')}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
        />
      </div>
      <div>
        <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', letterSpacing: '0.15em', display: 'block', marginBottom: '6px' }}>
          YOUR NAME
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Optional"
          style={{
            width: '100%', padding: '10px 14px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#E2E8F0',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '12px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          onFocus={e => (e.target.style.borderColor = 'rgba(0,212,255,0.4)')}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
        />
      </div>
      <div>
        <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', letterSpacing: '0.15em', display: 'block', marginBottom: '6px' }}>
          WHY DO YOU WANT FOUNDING ACCESS?
        </label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Tell us about your use case, background, or what you're looking to achieve with FAULTLINE..."
          rows={4}
          style={{
            width: '100%', padding: '10px 14px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#E2E8F0',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '12px',
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
          onFocus={e => (e.target.style.borderColor = 'rgba(0,212,255,0.4)')}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
        />
      </div>
      {requestMutation.error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FF4444', fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace" }}>
          <AlertCircle size={14} />
          {requestMutation.error.message}
        </div>
      )}
      <button
        type="submit"
        disabled={requestMutation.isPending || !email}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          padding: '12px 24px',
          background: requestMutation.isPending ? 'rgba(0,212,255,0.1)' : 'linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(0,102,255,0.15) 100%)',
          border: '1px solid rgba(0,212,255,0.4)',
          borderRadius: '8px',
          color: '#00D4FF',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '11px',
          letterSpacing: '0.12em',
          cursor: requestMutation.isPending ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s cubic-bezier(0.23,1,0.32,1)',
          opacity: requestMutation.isPending ? 0.7 : 1,
        }}
        onMouseEnter={e => { if (!requestMutation.isPending) (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,212,255,0.25) 0%, rgba(0,102,255,0.25) 100%)'); }}
        onMouseLeave={e => { if (!requestMutation.isPending) (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(0,102,255,0.15) 100%)'); }}
      >
        <Send size={13} />
        {requestMutation.isPending ? 'SUBMITTING…' : 'REQUEST FOUNDING ACCESS'}
      </button>
    </form>
  );
}

// ── Market Preflight Preference Card ─────────────────────────
type PreflightMode = 'full_guidance' | 'minimal_reminders' | 'off';

const PREFLIGHT_MODES: { value: PreflightMode; label: string; description: string }[] = [
  {
    value: 'full_guidance',
    label: 'Full Guidance',
    description: 'Show dashboard card, checklist CTA, missing checks, and helper prompts on relevant pages.',
  },
  {
    value: 'minimal_reminders',
    label: 'Minimal Reminders',
    description: 'Show only a compact score and "Run Market Preflight" button. No helper prompts.',
  },
  {
    value: 'off',
    label: 'Off',
    description: 'Hide page-level prompts and checklist reminders. Feature remains accessible from Profile and How to Use FAULTLINE.',
  },
];

function PreflightPreferenceCard() {
  const { user } = useAuth();
  const { data: modeData, isLoading } = trpc.awareness.getPreflightMode.useQuery(undefined, {
    enabled: !!user,
    staleTime: 60_000,
  });
  const setMode = trpc.awareness.setPreflightMode.useMutation({
    onSuccess: () => {
      utils.awareness.getPreflightMode.invalidate();
      toast.success('Preference saved');
    },
    onError: (err) => toast.error('Could not save preference', { description: err.message }),
  });
  const utils = trpc.useUtils();
  if (!user) return null;
  const currentMode = (modeData?.mode ?? 'full_guidance') as PreflightMode;
  return (
    <div style={{
      marginTop: '24px',
      background: 'rgba(0,212,255,0.02)',
      border: '1px solid rgba(0,212,255,0.12)',
      borderRadius: '12px',
      padding: '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00D4FF', boxShadow: '0 0 6px #00D4FF' }} />
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#00D4FF', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Market Preflight Prompts
        </span>
      </div>
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#9CA3AF', lineHeight: 1.6, marginBottom: '18px', marginTop: '6px' }}>
        Control how and where the Complete Market Awareness™ checklist appears. Your tracking history is preserved regardless of this setting.
      </p>
      {isLoading ? (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#4B5563', letterSpacing: '0.1em' }}>LOADING…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {PREFLIGHT_MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode.mutate({ mode: m.value })}
              disabled={setMode.isPending}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '14px 16px',
                background: currentMode === m.value ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.02)',
                border: currentMode === m.value ? '1px solid rgba(0,212,255,0.35)' : '1px solid rgba(255,255,255,0.07)',
                borderRadius: '8px',
                cursor: setMode.isPending ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease-out',
                opacity: setMode.isPending ? 0.7 : 1,
              }}
            >
              <div style={{
                width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
                border: currentMode === m.value ? '2px solid #00D4FF' : '2px solid rgba(255,255,255,0.2)',
                background: currentMode === m.value ? 'rgba(0,212,255,0.25)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {currentMode === m.value && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00D4FF' }} />}
              </div>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: currentMode === m.value ? '#F0F4FF' : '#9CA3AF', letterSpacing: '0.06em', marginBottom: '4px' }}>
                  {m.label}
                </div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#6B7280', lineHeight: 1.5 }}>
                  {m.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function UserAccount() {
  useSEO(PAGE_SEO.account);
  const { user, isAuthenticated, loading, logout } = useAuth();
  const profileQuery = trpc.user.getProfile.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });

  const profile = profileQuery.data;
  const tier = (profile?.accessTier ?? 'free') as 'free' | 'core' | 'premium' | 'founding';
  const tierCfg = TIER_CONFIG[tier];
  const isPremium = tier === 'premium' || tier === 'founding';
  const isCore = tier === 'core';
  const search = useSearch();

  // Handle Stripe redirect query params
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get('payment') === 'success') {
      toast.success('Payment successful!', { description: 'Your account has been upgraded. Welcome to FAULTLINE.' });
      window.history.replaceState({}, '', '/app/account');
    } else if (params.get('payment') === 'cancelled') {
      toast.error('Checkout cancelled', { description: 'No charge was made. You can upgrade anytime.' });
      window.history.replaceState({}, '', '/app/account');
    }
  }, [search]);

  const checkoutMutation = trpc.billing.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.info('Redirecting to checkout...', { description: 'Opening Stripe secure payment page.' });
        window.open(data.url, '_blank');
      }
    },
    onError: (err) => {
      toast.error('Checkout unavailable', { description: err.message });
    },
  });

  const portalMutation = trpc.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.info('Opening billing portal...', { description: 'Manage your subscription and invoices.' });
        window.open(data.url, '_blank');
      }
    },
    onError: (err) => {
      toast.error('Billing portal unavailable', { description: err.message });
    },
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  if (loading || !isAuthenticated) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '60vh', color: 'rgba(0,212,255,0.4)',
        fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.15em',
      }}>
        <span style={{ animation: 'fl-pulse 1.4s ease-in-out infinite' }}>AUTHENTICATING…</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 16px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div style={{
            width: '3px', height: '16px',
            background: 'linear-gradient(180deg, #00D4FF 0%, #0066FF 100%)',
            borderRadius: '2px',
          }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            ACCOUNT
          </span>
        </div>
        <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '26px', color: '#F0F4FF', letterSpacing: '0.06em', margin: 0 }}>
          INTELLIGENCE ACCESS
        </h1>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#6B7280', marginTop: '6px' }}>
          Manage your FAULTLINE account, access tier, and platform preferences.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {/* ── Profile card ── */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,102,255,0.2) 100%)',
              border: '1px solid rgba(0,212,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#00D4FF', flexShrink: 0,
            }}>
              <User size={18} />
            </div>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#6B7280', letterSpacing: '0.1em' }}>
                IDENTITY
              </div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '15px', color: '#E2E8F0', letterSpacing: '0.04em' }}>
                {profile?.name ?? user?.name ?? 'FAULTLINE USER'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Email */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Mail size={13} style={{ color: '#4B5563', flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.15em' }}>EMAIL</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9CA3AF' }}>
                  {profile?.email ?? user?.email ?? '—'}
                </div>
              </div>
            </div>

            {/* Member since */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={13} style={{ color: '#4B5563', flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.15em' }}>MEMBER SINCE</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9CA3AF' }}>
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                </div>
              </div>
            </div>

            {/* Role */}
            {profile?.role === 'admin' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Shield size={13} style={{ color: '#FF9500', flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.15em' }}>ROLE</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#FF9500' }}>ADMINISTRATOR</div>
                </div>
              </div>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              marginTop: '20px', padding: '8px 14px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
              color: '#6B7280',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '10px', letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              width: '100%', justifyContent: 'center',
            }}
            onMouseEnter={e => { (e.currentTarget.style.color = '#FF4444'); (e.currentTarget.style.borderColor = 'rgba(255,68,68,0.3)'); }}
            onMouseLeave={e => { (e.currentTarget.style.color = '#6B7280'); (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'); }}
          >
            <LogOut size={12} />
            SIGN OUT
          </button>
        </div>

        {/* ── Access Tier card ── */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${tierCfg.border}`,
          borderRadius: '12px',
          padding: '24px',
          boxShadow: `0 0 24px ${tierCfg.glow}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', letterSpacing: '0.2em' }}>
              ACCESS TIER
            </div>
            <TierBadge tier={tier} />
          </div>

          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#9CA3AF', lineHeight: 1.6, marginBottom: '20px' }}>
            {tierCfg.description}
          </div>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tierCfg.features.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {f.available ? (
                  <CheckCircle size={13} style={{ color: tierCfg.color, flexShrink: 0 }} />
                ) : (
                  <Lock size={13} style={{ color: '#374151', flexShrink: 0 }} />
                )}
                <span style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: '12px',
                  color: f.available ? '#D1D5DB' : '#4B5563',
                }}>
                  {f.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Billing management for core/premium/founding users ── */}
      {(isPremium || isCore) && (
        <div style={{
          marginTop: '24px',
          background: 'rgba(6,182,212,0.03)',
          border: '1px solid rgba(6,182,212,0.15)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <CreditCard size={16} style={{ color: '#06B6D4' }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#06B6D4', letterSpacing: '0.1em' }}>
                BILLING & SUBSCRIPTION
              </span>
            </div>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
              Manage your subscription, view invoices, and update payment details.
            </p>
          </div>
          <button
            onClick={() => portalMutation.mutate({ origin: window.location.origin })}
            disabled={portalMutation.isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 18px',
              background: 'rgba(6,182,212,0.1)',
              border: '1px solid rgba(6,182,212,0.3)',
              borderRadius: '8px',
              color: '#06B6D4',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '10px', letterSpacing: '0.1em',
              cursor: portalMutation.isPending ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              opacity: portalMutation.isPending ? 0.6 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            {portalMutation.isPending ? 'LOADING...' : 'MANAGE BILLING'} <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* ── Market Preflight Prompts Preference ── */}
      <PreflightPreferenceCard />

      {/* ── Upgrade section (only for free tier) ── */}
      {!isPremium && !isCore && (
        <div style={{
          marginTop: '24px',
          background: 'rgba(255,215,0,0.03)',
          border: '1px solid rgba(255,215,0,0.15)',
          borderRadius: '12px',
          padding: '28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Crown size={18} style={{ color: '#FFD700' }} />
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#FFD700', letterSpacing: '0.12em' }}>
              REQUEST FOUNDING ACCESS
            </div>
          </div>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#9CA3AF', lineHeight: 1.6, marginBottom: '24px' }}>
            FAULTLINE Founding Access is reserved for a limited cohort of institutional analysts, portfolio managers, and sophisticated investors. 
            Founding members receive lifetime pricing, early feature access, and the full intelligence platform.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Full Intelligence Platform', icon: <Zap size={13} /> },
              { label: 'Aftershock Engine™', icon: <Shield size={13} /> },
              { label: 'Founding Member Badge', icon: <Crown size={13} /> },
              { label: 'Lifetime Pricing Lock', icon: <CheckCircle size={13} /> },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px',
                background: 'rgba(255,215,0,0.05)',
                border: '1px solid rgba(255,215,0,0.1)',
                borderRadius: '8px',
                color: '#FFD700',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '10px', letterSpacing: '0.08em',
              }}>
                {item.icon}
                {item.label}
              </div>
            ))}
          </div>

          {/* Quick upgrade via Stripe */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button
              onClick={() => checkoutMutation.mutate({ planId: 'core', origin: window.location.origin })}
              disabled={checkoutMutation.isPending}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 20px',
                background: 'rgba(34,211,238,0.12)',
                border: '1px solid rgba(34,211,238,0.4)',
                borderRadius: '8px',
                color: '#22D3EE',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '11px', letterSpacing: '0.08em',
                cursor: checkoutMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: checkoutMutation.isPending ? 0.6 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              <Zap size={13} />
              {checkoutMutation.isPending ? 'LOADING...' : `CORE — ${PRICING_PLANS.core.priceLabel.toUpperCase()}`}
            </button>
            <button
              onClick={() => checkoutMutation.mutate({ planId: 'premium', origin: window.location.origin })}
              disabled={checkoutMutation.isPending}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 20px',
                background: 'rgba(6,182,212,0.12)',
                border: '1px solid rgba(6,182,212,0.4)',
                borderRadius: '8px',
                color: '#06B6D4',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '11px', letterSpacing: '0.08em',
                cursor: checkoutMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: checkoutMutation.isPending ? 0.6 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              <CreditCard size={13} />
              {checkoutMutation.isPending ? 'LOADING...' : `UPGRADE — ${PRICING_PLANS.premium.priceLabel.toUpperCase()}`}
            </button>
            <button
              onClick={() => checkoutMutation.mutate({ planId: 'founding', origin: window.location.origin })}
              disabled={checkoutMutation.isPending}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 20px',
                background: 'rgba(255,215,0,0.1)',
                border: '1px solid rgba(255,215,0,0.35)',
                borderRadius: '8px',
                color: '#FFD700',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '11px', letterSpacing: '0.08em',
                cursor: checkoutMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: checkoutMutation.isPending ? 0.6 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              <Crown size={13} />
              {checkoutMutation.isPending ? 'LOADING...' : `FOUNDING — ${PRICING_PLANS.founding.priceLabel.toUpperCase()}`}
            </button>
            <button
              onClick={() => checkoutMutation.mutate({ planId: 'lifetime', origin: window.location.origin })}
              disabled={checkoutMutation.isPending}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 20px',
                background: 'rgba(255,215,0,0.05)',
                border: '1px solid rgba(255,215,0,0.2)',
                borderRadius: '8px',
                color: '#FFD700',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '11px', letterSpacing: '0.08em',
                cursor: checkoutMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: checkoutMutation.isPending ? 0.6 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              <Crown size={13} />
              {checkoutMutation.isPending ? 'LOADING...' : `LIFETIME — ${PRICING_PLANS.lifetime.priceLabel.toUpperCase()}`}
            </button>
          </div>
          {/* Limited spots disclaimer */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 14px',
            background: 'rgba(255,215,0,0.04)',
            border: '1px solid rgba(255,215,0,0.15)',
            borderRadius: '8px',
            marginBottom: '16px',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FFD700', flexShrink: 0 }} />
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '9px', letterSpacing: '0.12em',
              color: 'rgba(255,215,0,0.55)',
            }}>
              FOUNDING COHORT IS LIMITED — SPOTS CLOSE WITHOUT NOTICE — PRICE LOCKS AT SIGNUP
            </span>
          </div>

          <FoundingAccessForm userEmail={profile?.email ?? user?.email} />
        </div>
      )}

      {/* ── Premium tier: upgrade prompt ── */}
      {tier === 'premium' && (
        <div style={{
          marginTop: '24px',
          background: 'rgba(255,215,0,0.03)',
          border: '1px solid rgba(255,215,0,0.12)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Crown size={16} style={{ color: '#FFD700' }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#FFD700', letterSpacing: '0.1em' }}>
                UPGRADE TO FOUNDING
              </span>
            </div>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
              Lock in founding member pricing and get early access to all future features.
            </p>
          </div>
          <button
            onClick={() => {
              const el = document.getElementById('founding-form');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 18px',
              background: 'rgba(255,215,0,0.1)',
              border: '1px solid rgba(255,215,0,0.3)',
              borderRadius: '8px',
              color: '#FFD700',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '10px', letterSpacing: '0.1em',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,215,0,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,215,0,0.1)')}
          >
            REQUEST FOUNDING ACCESS <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* ── Founding tier: confirmation ── */}
      {tier === 'founding' && (
        <div style={{
          marginTop: '24px',
          background: 'rgba(255,215,0,0.04)',
          border: '1px solid rgba(255,215,0,0.2)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex', alignItems: 'center', gap: '16px',
        }}>
          <Crown size={28} style={{ color: '#FFD700', flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#FFD700', letterSpacing: '0.1em', marginBottom: '6px' }}>
              FOUNDING MEMBER — FULL ACCESS GRANTED
            </div>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
              You have complete access to the FAULTLINE intelligence platform. Thank you for being a founding member.
            </p>
          </div>
        </div>
      )}

      {/* ── Shared Reports Management ── */}
      <SharedReportsPanel />
    </div>
  );
}

function SharedReportsPanel() {
  const { user } = useAuth();
  const reportsQuery = trpc.sharedReports.listMine.useQuery(undefined, { enabled: !!user });
  const revokeMut = trpc.sharedReports.revoke.useMutation({
    onSuccess: () => reportsQuery.refetch(),
    onError: () => toast.error('Failed to revoke link'),
  });

  if (!user) return null;

  const reports = reportsQuery.data ?? [];
  const activeReports = reports.filter(r => !r.revoked);

  const REPORT_TYPE_LABELS: Record<string, string> = {
    stock_intelligence: 'STOCK SIGNALS',
    crypto_intelligence: 'CRYPTO SIGNALS',
    market_preflight: 'TRADE PREFLIGHT',
    diagnostic_ai: 'DIAGNOSTIC AI',
    daily_report: 'DAILY REPORT',
  };

  return (
    <div style={{
      marginTop: '32px',
      background: 'rgba(0,212,255,0.02)',
      border: '1px solid rgba(0,212,255,0.12)',
      borderRadius: '12px',
      padding: '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Share2 size={16} style={{ color: '#00D4FF' }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#00D4FF', letterSpacing: '0.12em' }}>
            SHARED REPORTS
          </span>
        </div>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(100,116,139,0.6)', letterSpacing: '0.08em' }}>
          {activeReports.length} ACTIVE LINK{activeReports.length !== 1 ? 'S' : ''}
        </span>
      </div>

      {reportsQuery.isLoading ? (
        <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(100,116,139,0.5)', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px' }}>
          LOADING...
        </div>
      ) : reports.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '24px',
          background: 'rgba(0,212,255,0.02)',
          border: '1px dashed rgba(0,212,255,0.1)',
          borderRadius: '8px',
        }}>
          <Share2 size={20} style={{ color: 'rgba(100,116,139,0.3)', marginBottom: '8px' }} />
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(100,116,139,0.5)', letterSpacing: '0.08em' }}>
            NO SHARED REPORTS YET
          </div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: 'rgba(100,116,139,0.4)', marginTop: '6px' }}>
            Use the Share button on any intelligence page to create a public link.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {reports.map(report => {
            const isExpired = report.expiresAt ? new Date(report.expiresAt) < new Date() : false;
            const statusColor = report.revoked ? '#FF2D55' : isExpired ? '#FF9500' : '#00FF88';
            const statusLabel = report.revoked ? 'REVOKED' : isExpired ? 'EXPIRED' : 'ACTIVE';
            return (
              <div key={report.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px',
                background: report.revoked || isExpired ? 'rgba(255,255,255,0.01)' : 'rgba(0,212,255,0.03)',
                border: `1px solid ${report.revoked || isExpired ? 'rgba(255,255,255,0.06)' : 'rgba(0,212,255,0.1)'}`,
                borderRadius: '8px',
                opacity: report.revoked || isExpired ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}>
                {/* Status dot */}
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />

                {/* Report info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#00D4FF', letterSpacing: '0.1em', background: 'rgba(0,212,255,0.08)', padding: '2px 6px', borderRadius: '3px' }}>
                      {REPORT_TYPE_LABELS[report.reportType] ?? report.reportType.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: statusColor, letterSpacing: '0.08em' }}>
                      {statusLabel}
                    </span>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {report.subject}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '3px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'rgba(100,116,139,0.5)' }}>
                      <Eye size={9} style={{ display: 'inline', marginRight: '3px' }} />
                      {report.viewCount} VIEWS
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'rgba(100,116,139,0.5)' }}>
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                    {report.expiresAt && (
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: isExpired ? '#FF9500' : 'rgba(100,116,139,0.5)' }}>
                        EXP {new Date(report.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {!report.revoked && !isExpired && (
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <a
                      href={report.shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open shared report"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '28px', height: '28px',
                        background: 'rgba(0,212,255,0.08)',
                        border: '1px solid rgba(0,212,255,0.2)',
                        borderRadius: '6px',
                        color: '#00D4FF',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <ExternalLink size={12} />
                    </a>
                    <button
                      onClick={() => {
                        if (confirm('Revoke this share link? Anyone with the link will no longer be able to view it.')) {
                          revokeMut.mutate({ id: report.id });
                        }
                      }}
                      disabled={revokeMut.isPending}
                      title="Revoke share link"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '28px', height: '28px',
                        background: 'rgba(255,45,85,0.06)',
                        border: '1px solid rgba(255,45,85,0.2)',
                        borderRadius: '6px',
                        color: '#FF2D55',
                        cursor: revokeMut.isPending ? 'not-allowed' : 'pointer',
                        opacity: revokeMut.isPending ? 0.5 : 1,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
