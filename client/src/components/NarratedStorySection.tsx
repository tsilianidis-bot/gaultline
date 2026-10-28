import { useEffect, useRef, useState } from "react";

const POSTER = "/media/pressure-intro/pressure-intro-poster.webp";
const DESKTOP_VIDEO = "/media/pressure-intro/pressure-intro-desktop.mp4";
const MOBILE_VIDEO = "/media/pressure-intro/pressure-intro-mobile.mp4";
const ENGLISH_CAPTIONS = "/media/pressure-intro/pressure-intro-captions.vtt";
const MOBILE_PRESENTATION_QUERY = "(max-width: 767px), (pointer: coarse)";

/**
 * An in-page replay of the original narrated presentation.
 *
 * The video element intentionally mounts without a source. A source and caption
 * track are only added after the visitor presses Play, and play() is called from
 * that same click so sound can begin under the browser's user-gesture policy.
 */
export default function NarratedStorySection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (!video) return;

      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, []);

  const playNarratedPresentation = () => {
    const video = videoRef.current;
    if (!video) return;

    const useMobilePresentation = window.matchMedia(MOBILE_PRESENTATION_QUERY).matches;
    const selectedVideo = useMobilePresentation ? MOBILE_VIDEO : DESKTOP_VIDEO;

    // Keep the source assignment and play() call inside this click handler. In
    // particular, do not wait for a state update before requesting sound.
    video.src = selectedVideo;
    video.muted = false;
    video.defaultMuted = false;
    video.volume = 1;
    video.load();
    const playback = video.play();

    setHasStarted(true);
    setPlaybackError(null);

    void playback.catch(() => {
      setPlaybackError("The presentation could not be played. Please try again.");
    });
  };

  return (
    <section
      aria-labelledby="narrated-story-heading"
      className="border-b border-[#65D6E5]/10 bg-[#0A0D12] py-16 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:mb-10 sm:flex-row sm:items-end sm:gap-8">
          <div className="max-w-4xl">
            <p className="text-[12px] font-semibold tracking-[0.06em] text-[#65D6E5]">
              ORIGINAL NARRATED PRESENTATION
            </p>
            <h2
              id="narrated-story-heading"
              className="mt-4 text-3xl font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-5xl"
            >
              WHY FAULTLINE? — PRESSURE BENEATH THE SURFACE
            </h2>
            <p className="mt-5 text-base leading-[1.75] text-[#C9D4E0] sm:text-lg">
              Watch the complete original narrated presentation.
            </p>
          </div>
          <p className="inline-flex w-fit shrink-0 items-center rounded-full border border-[#C6A66B]/40 bg-[#C6A66B]/[0.06] px-3 py-1.5 text-[11px] font-semibold tracking-[0.06em] text-[#E6D8BC]">
            35 SECONDS · SOUND ON
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#65D6E5]/25 bg-[#030609] shadow-[0_24px_80px_-36px_rgba(101,214,229,0.42)]">
          <div className="relative aspect-video bg-[#030609]">
            <video
              ref={videoRef}
              aria-label="Narrated presentation"
              className="block h-full w-full object-contain"
              controls={hasStarted}
              playsInline
              poster={POSTER}
              preload="none"
              onError={(event) => {
                if (event.currentTarget.error) {
                  setPlaybackError("The presentation could not be played. Please try again.");
                }
              }}
            >
              {hasStarted && (
                <track
                  kind="captions"
                  src={ENGLISH_CAPTIONS}
                  srcLang="en"
                  label="English"
                />
              )}
            </video>

            {!hasStarted && (
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-[#030609]/80 via-transparent to-[#030609]/10 p-4 sm:p-6">
                <div className="flex flex-col items-start gap-3">
                  <button
                    type="button"
                    onClick={playNarratedPresentation}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#65D6E5] px-5 py-3 text-[12px] font-semibold tracking-[0.06em] text-[#050608] transition-colors hover:bg-[#8BE6F0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M5 3.25 12 8 5 12.75V3.25Z" fill="currentColor" />
                    </svg>
                    Play narrated presentation
                  </button>
                  <p className="text-[12px] leading-[1.6] text-[#E3E5E8]">
                    Starts with sound. English captions are available in the player controls.
                  </p>
                </div>
              </div>
            )}
          </div>

          {playbackError && (
            <div className="flex flex-col gap-3 border-t border-[#C6A66B]/25 bg-[#0A0D12] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-sm leading-[1.6] text-[#E6D8BC]" role="status">
                {playbackError}
              </p>
              <button
                type="button"
                onClick={playNarratedPresentation}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-[#65D6E5]/50 px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[#65D6E5] transition-colors hover:border-[#65D6E5] hover:bg-[#65D6E5]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
