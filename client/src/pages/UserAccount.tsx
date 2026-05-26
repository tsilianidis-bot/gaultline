/* ============================================================
   FAULTLINE — User Account & Access Tier Dashboard
   Shows user profile, current access tier, tier benefits,
   and founding access request form.
   ============================================================ */
import { useState, useEffect } from 'react';
import { Shield, Zap, Crown, User, Mail, Clock, LogOut, ChevronRight, Lock, CheckCircle, Send, AlertCircle, CreditCard } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { getLoginUrl } from '@/const';
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import { toast } from 'sonner';
import { useSearch } from 'wouter';

// ── Tier config ────────────────────────────────────────────────
const TIER_CONFIG = {
  core: {
    label: 'CORE',
    sublabel: 'Core Access',
    color: '#22D3EE',
    glow: 'rgba(34,211,238,0.2)',
    border: 'rgba(34,211,238,0.3)',
    icon: <Zap size={18} />,
    description: 'Signals screener, Portfolio tracker, and Alt Rotation — the essential FAULTLINE toolkit.',
    features: [
      { label: 'Signals screener (BUY/SELL/HOLD)', available: true },
      { label: 'Portfolio tracker with live P&L', available: true },
      { label: 'Alt Rotation engine', available: true },
      { label: 'Dashboard & macro snapshots', available: true },
      { label: 'AI position guidance', available: false },
      { label: 'Diagnostic AI™', available: false },
      { label: 'Crypto intelligence engine', available: false },
      { label: 'Aftershock Engine™', available: false },
    ],
  },
  free: {
    label: 'FREE',
    sublabel: 'Basic Access',
    color: '#6B7280',
    glow: 'rgba(107,114,128,0.2)',
    border: 'rgba(107,114,128,0.3)',
    icon: <User size={18} />,
    description: 'Limited dashboard access with basic previews and teaser analytics.',
    features: [
      { label: 'Homepage & limited previews', available: true },
      { label: 'Basic macro snapshots', available: true },
      { label: 'Limited live metrics', available: true },
      { label: 'Advanced signals engine', available: false },
      { label: 'Aftershock Engine™', available: false },
      { label: 'Full stock & crypto intelligence', available: false },
      { label: 'Real-time risk analytics', available: false },
      { label: 'Premium dashboards', available: false },
    ],
  },
  premium: {
    label: 'PREMIUM',
    sublabel: 'Full Intelligence',
    color: '#00D4FF',
    glow: 'rgba(0,212,255,0.2)',
    border: 'rgba(0,212,255,0.35)',
    icon: <Zap size={18} />,
    description: 'Complete access to the FAULTLINE intelligence platform.',
    features: [
      { label: 'Full macro regime intelligence', available: true },
      { label: 'Advanced trading signals', available: true },
      { label: 'Full stock & crypto intelligence', available: true },
      { label: 'Aftershock Engine™', available: true },
      { label: 'Real-time risk analytics', available: true },
      { label: 'Premium dashboards', available: true },
      { label: 'Portfolio monitor', available: true },
      { label: 'Proprietary scoring systems', available: true },
    ],
  },
  founding: {
    label: 'FOUNDING',
    sublabel: 'Founding Member',
    color: '#FFD700',
    glow: 'rgba(255,215,0,0.2)',
    border: 'rgba(255,215,0,0.4)',
    icon: <Crown size={18} />,
    description: 'Exclusive founding member access — early adopter benefits, lifetime pricing, and priority features.',
    features: [
      { label: 'Everything in Premium', available: true },
      { label: 'Founding member badge', available: true },
      { label: 'Early access to new features', available: true },
      { label: 'Priority support', available: true },
      { label: 'Lifetime pricing lock', available: true },
      { label: 'Direct feedback channel', available: true },
      { label: 'Beta feature access', available: true },
      { label: 'Founding member recognition', available: true },
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
              {checkoutMutation.isPending ? 'LOADING...' : 'CORE — $9.99/MONTH'}
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
              {checkoutMutation.isPending ? 'LOADING...' : 'UPGRADE — $59/MONTH'}
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
              {checkoutMutation.isPending ? 'LOADING...' : 'FOUNDING — $49/MONTH FOR LIFE'}
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
              {checkoutMutation.isPending ? 'LOADING...' : 'LIFETIME — $1,200 ONE-TIME'}
            </button>
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
    </div>
  );
}
