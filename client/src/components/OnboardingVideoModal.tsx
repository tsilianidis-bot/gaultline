/**
 * OnboardingVideoModal
 *
 * Shown automatically to every new user on first login.
 * Plays the FAULTLINE Getting Started video.
 * Users can skip (with a warning) or watch to completion.
 * Preference is persisted to the database so the modal never shows again.
 */

import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { X, Play, SkipForward, AlertTriangle, CheckCircle } from "lucide-react";

const VIDEO_URL = "/manus-storage/faultline-getting-started_90489fa6.mp4";

export function OnboardingVideoModal() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [completed, setCompleted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { data: prefs, isLoading } = trpc.dailyBrief.getPreferences.useQuery(undefined, {
    enabled: !!user,
  });

  const markVideoSeen = trpc.dailyBrief.markVideoSeen.useMutation();

  // Show modal for logged-in users who haven't seen the video
  useEffect(() => {
    if (!isLoading && user && prefs !== undefined) {
      if (!prefs || !prefs.hasSeenGettingStartedVideo) {
        // Small delay so the page loads first
        const t = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(t);
      }
    }
  }, [isLoading, user, prefs]);

  // Auto-play when modal opens
  useEffect(() => {
    if (visible && videoRef.current) {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
    }
  }, [visible]);

  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress((v.currentTime / v.duration) * 100);
    setDuration(v.duration);
  }

  function handleEnded() {
    setCompleted(true);
    setPlaying(false);
    handleDismiss();
  }

  function handleDismiss() {
    setVisible(false);
    setShowSkipWarning(false);
    markVideoSeen.mutate();
  }

  function handleSkipClick() {
    if (!completed) {
      setShowSkipWarning(true);
    } else {
      handleDismiss();
    }
  }

  function handleConfirmSkip() {
    handleDismiss();
  }

  function handleCancelSkip() {
    setShowSkipWarning(false);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
    }
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  if (!visible) return null;

  const elapsed = videoRef.current ? videoRef.current.currentTime : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(6px)",
        padding: "16px",
        animation: "fadeIn 0.3s ease-out",
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .onboarding-modal { animation: slideUp 0.35s cubic-bezier(0.23,1,0.32,1); }
        .progress-bar-fill { transition: width 0.5s linear; }
      `}</style>

      <div
        className="onboarding-modal"
        style={{
          width: "100%",
          maxWidth: "800px",
          background: "#0A0E1A",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: "#00D4FF", boxShadow: "0 0 8px #00D4FF",
            }} />
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.12em",
              color: "#00D4FF",
              textTransform: "uppercase",
            }}>
              FAULTLINE — GETTING STARTED
            </span>
          </div>
          <button
            onClick={handleSkipClick}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(148,163,184,0.5)",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
              transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(148,163,184,0.9)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(148,163,184,0.5)")}
          >
            <X size={18} />
          </button>
        </div>

        {/* Video */}
        <div style={{ position: "relative", background: "#000", cursor: "pointer" }} onClick={togglePlay}>
          <video
            ref={videoRef}
            src={VIDEO_URL}
            style={{ width: "100%", display: "block", maxHeight: "450px", objectFit: "contain" }}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
            playsInline
          />
          {/* Play overlay when paused */}
          {!playing && !completed && (
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.3)",
            }}>
              <div style={{
                width: "64px", height: "64px", borderRadius: "50%",
                background: "rgba(0,212,255,0.15)",
                border: "2px solid rgba(0,212,255,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Play size={28} color="#00D4FF" style={{ marginLeft: "3px" }} />
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ height: "3px", background: "rgba(255,255,255,0.06)" }}>
          <div
            className="progress-bar-fill"
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "linear-gradient(90deg, #00D4FF, #7C3AED)",
            }}
          />
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}>
          <div style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: "12px",
            color: "rgba(148,163,184,0.6)",
          }}>
            {duration > 0 ? `${formatTime(elapsed)} / ${formatTime(duration)}` : "Loading..."}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: "11px",
              color: "rgba(148,163,184,0.45)",
              fontStyle: "italic",
            }}>
              Watching this will make FAULTLINE significantly more useful
            </span>
            <button
              onClick={handleSkipClick}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent",
                color: "rgba(148,163,184,0.6)",
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: "12px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                e.currentTarget.style.color = "rgba(148,163,184,0.9)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                e.currentTarget.style.color = "rgba(148,163,184,0.6)";
              }}
            >
              <SkipForward size={13} />
              Skip
            </button>
          </div>
        </div>

        {/* Skip warning overlay */}
        {showSkipWarning && (
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 10,
            borderRadius: "16px",
          }}>
            <div style={{
              background: "#0F1629",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: "12px",
              padding: "28px 32px",
              maxWidth: "380px",
              textAlign: "center",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "14px",
              }}>
                <AlertTriangle size={28} color="#F59E0B" />
              </div>
              <div style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: "15px",
                fontWeight: 600,
                color: "#E2E8F0",
                marginBottom: "10px",
              }}>
                Skip the Getting Started video?
              </div>
              <div style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: "13px",
                color: "rgba(148,163,184,0.7)",
                lineHeight: 1.6,
                marginBottom: "22px",
              }}>
                This video explains how FAULTLINE works — the Seismograph, Pressure Index, regime probabilities, and ASHA. Skipping is not recommended for new users.
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <button
                  onClick={handleCancelSkip}
                  style={{
                    padding: "9px 20px",
                    borderRadius: "7px",
                    border: "none",
                    background: "linear-gradient(135deg, #00D4FF, #7C3AED)",
                    color: "#fff",
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Keep Watching
                </button>
                <button
                  onClick={handleConfirmSkip}
                  style={{
                    padding: "9px 20px",
                    borderRadius: "7px",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "transparent",
                    color: "rgba(148,163,184,0.6)",
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Skip anyway (not recommended)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
