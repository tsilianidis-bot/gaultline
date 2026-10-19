import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Pause, Play } from "lucide-react";
import { CoreTopology } from "@/components/intelligence-core-visual/CoreTopology";
import {
  createUnavailableCore,
  DOMAIN_LABELS,
} from "@/components/intelligence-core-visual/adapter";
import type { DomainId } from "@/components/intelligence-core-visual/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trackStartFreeClicked } from "@/hooks/useAnalytics";
import "@/components/intelligence-core-visual/intelligence-core.css";
import "@/components/intelligence-core-visual/core-refinement.css";
import "./premium-marketing.css";

const DOMAIN_CONTEXT: Record<DomainId, { question: string; detail: string }> = {
  liquidity: {
    question: "Is funding becoming harder to access?",
    detail:
      "Read funding conditions alongside credit and rates. A domain name describes the intelligence architecture, not proof of a current funding-stress signal.",
  },
  credit: {
    question: "Is stress appearing across credit markets?",
    detail:
      "Put credit conditions in cross-market context. The organization lines here do not establish contagion or a causal transmission path.",
  },
  volatility: {
    question: "Is the character of market risk changing?",
    detail:
      "Distinguish a volatility-regime assessment from a rates proxy. Current volatility claims require the domain’s own admitted evidence.",
  },
  macro: {
    question: "Which economic conditions matter now?",
    detail:
      "Read rates, inflation and labor-market conditions with their publication dates. A monthly observation is not a real-time measurement.",
  },
  breadth: {
    question: "How broad is market participation?",
    detail:
      "Breadth needs verified participation evidence. It must not be inferred from the legacy Pressure Index’s similarly named macro proxy.",
  },
  ai: {
    question: "Where is concentration creating fragility?",
    detail:
      "Separate measured concentration evidence from a static model baseline. The legacy AI / Speculation vector is not a live AI-bubble observation.",
  },
};

export default function MarketingIntelligenceHero() {
  const model = useMemo(
    () =>
      createUnavailableCore(
        "Illustrative architecture. No live domain evidence is connected to this marketing visualization."
      ),
    []
  );
  const heroRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [highlight, setHighlight] = useState<DomainId | null>(null);
  const [selected, setSelected] = useState<DomainId | null>(null);
  const [paused, setPaused] = useState(false);
  // Without a visibility observer, keep the architecture static.
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionChange = () => setReducedMotion(media.matches);
    const visibilityChange = () => setVisible(!document.hidden);
    motionChange();
    visibilityChange();
    media.addEventListener("change", motionChange);
    document.addEventListener("visibilitychange", visibilityChange);
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => setInView(entry.isIntersecting),
            { threshold: 0.05 }
          );
    if (heroRef.current) observer?.observe(heroRef.current);
    return () => {
      observer?.disconnect();
      media.removeEventListener("change", motionChange);
      document.removeEventListener("visibilitychange", visibilityChange);
    };
  }, []);

  const highlightFromTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return;
    const label = target.closest(".fic-domain")?.getAttribute("aria-label");
    const domain = model.domains.find(item =>
      label?.startsWith(`Inspect ${item.label}:`)
    );
    if (domain) setHighlight(domain.id);
  };

  return (
    <section
      ref={heroRef}
      className="mp-hero"
      aria-labelledby="premium-hero-title"
    >
      <div className="mp-hero-layout">
        <div className="mp-hero-copy">
          <p className="mp-eyebrow">
            <span aria-hidden="true" /> STRUCTURAL MARKET INTELLIGENCE
          </p>
          <h1 id="premium-hero-title">
            See the pressure
            <br />
            building.
            <br />
            <span>
              Understand
              <br />
              what it means.
            </span>
          </h1>
          <p className="mp-hero-lead">
            Markets don’t move in isolation. FAULTLINE connects the conditions
            behind the market so you can understand what’s happening, why it
            matters, and what to watch next.
          </p>
          <p className="mp-hero-context">
            Systemic pressure. Cross-market context. Evidence-led
            interpretation—not another screen of unexplained signals.
          </p>
          <div className="mp-hero-actions">
            <a
              className="mp-button mp-button-primary"
              href="/pressure-index"
              onClick={() => trackStartFreeClicked("marketing_rebuild_hero")}
            >
              Explore FAULTLINE <ArrowRight size={17} />
            </a>
            <a className="mp-button mp-button-outline" href="#product-showcase">
              See Intelligence in Action <ArrowUpRight size={16} />
            </a>
          </div>
          <p className="mp-access-note">Public preview · No account required</p>
          <a href="#access" className="mp-membership-link">
            Become a Member <span>Standard $99/month</span>
            <ArrowUpRight size={14} />
          </a>
          <p className="mp-no-prediction">
            Pressure is context, not a prediction of a crash.
          </p>
        </div>
        <div className="mp-network-panel">
          <div className="mp-network-heading">
            <span>THE INTELLIGENCE ARCHITECTURE</span>
            <span className="mp-gold">SIX CONNECTED DOMAINS</span>
          </div>
          <div
            className="fic mp-illustration"
            data-motion={
              paused || !inView || !visible || reducedMotion
                ? "paused"
                : "running"
            }
            onPointerOver={event => highlightFromTarget(event.target)}
            onPointerLeave={() => setHighlight(null)}
            onFocusCapture={event => highlightFromTarget(event.target)}
            onBlurCapture={event => {
              if (!event.currentTarget.contains(event.relatedTarget))
                setHighlight(null);
            }}
          >
            <CoreTopology
              model={model}
              selectedDomain={selected || highlight}
              scenarioDomains={[]}
              onSelect={id => {
                triggerRef.current = document.activeElement as HTMLElement;
                setSelected(id);
              }}
            />
            <div className="mp-center-readout" aria-hidden="true">
              <span>FAULTLINE</span>
              <strong>
                One market.
                <br />
                Six domains.
              </strong>
              <small>CONTEXT BEFORE CONVICTION</small>
            </div>
          </div>
          <div
            className="mp-domain-context"
            aria-live="polite"
            aria-atomic="true"
          >
            <span>
              {highlight ? DOMAIN_LABELS[highlight] : "EXPLORE THE CONNECTIONS"}
            </span>
            <p>
              {highlight
                ? DOMAIN_CONTEXT[highlight].question
                : "Hover, focus or tap a domain to understand its role."}
            </p>
          </div>
          <div className="mp-visualization-note">
            <p>
              <span className="mp-gold">ILLUSTRATIVE VISUALIZATION</span> · Not
              live risk transmission. Lines show organization, not verified
              causation. No market scores or source states are simulated.
            </p>
            <button
              type="button"
              onClick={() => setPaused(!paused)}
              disabled={reducedMotion}
              aria-pressed={paused || reducedMotion || !inView || !visible}
              aria-label={
                reducedMotion
                  ? "Reduced motion: illustrative animation paused"
                  : paused
                    ? "Resume illustrative animation"
                    : "Pause illustrative animation"
              }
            >
              {paused ? <Play size={13} /> : <Pause size={13} />}{" "}
              {reducedMotion ? "Reduced motion" : paused ? "Resume" : "Pause"}
            </button>
          </div>
        </div>
      </div>
      <div className="mp-value-strip" aria-label="Intelligence principles">
        <span>
          01 <strong>Read the conditions</strong>
        </span>
        <span>
          02 <strong>Understand the drivers</strong>
        </span>
        <span>
          03 <strong>Know what would change the view</strong>
        </span>
      </div>
      <Dialog
        open={selected !== null}
        onOpenChange={open => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent
          className="mp-domain-dialog"
          onCloseAutoFocus={event => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          <DialogHeader>
            <p className="mp-eyebrow">EDUCATIONAL DOMAIN EXPLANATION</p>
            <DialogTitle>
              {selected ? DOMAIN_LABELS[selected] : "Intelligence domain"}
            </DialogTitle>
            <DialogDescription>
              {selected ? DOMAIN_CONTEXT[selected].question : ""}
            </DialogDescription>
          </DialogHeader>
          <p>{selected ? DOMAIN_CONTEXT[selected].detail : ""}</p>
          <p className="mp-dialog-disclosure">
            This is a visualization, not a current market assessment. No
            verified domain observation, developing-since date or historical
            comparison is supplied here. Missing evidence is never an all-clear
            signal.
          </p>
          <a href="/methodology" className="mp-text-link">
            Read the methodology <ArrowUpRight size={15} />
          </a>
        </DialogContent>
      </Dialog>
    </section>
  );
}
