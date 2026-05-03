import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AD_NETWORKS } from "@/config/adNetworks";

const SESSION_KEY = "interstitial-shown";

/**
 * Full-screen interstitial ad with a countdown gate before the close
 * button appears. Fires once per session, after the first user gesture
 * (so Googlebot — which doesn't click — never sees it, sidestepping
 * Google's "intrusive interstitial" SEO penalty).
 *
 * The actual ad creative is whatever the network gives you — usually:
 *   - an iframe URL (Adsterra "direct link" / PropellerAds "interstitial"
 *     / Monetag "vignette") rendered via `interstitial.iframeSrc`
 *   - or an arbitrary HTML snippet via `interstitial.htmlSnippet`
 */
export function InterstitialAd() {
  const cfg = AD_NETWORKS.interstitial;
  const [armed, setArmed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(cfg.skipAfterSeconds);

  // Arm on first user gesture, then mark session and show.
  useEffect(() => {
    if (!cfg.enabled) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    let cancelled = false;
    const fire = () => {
      if (cancelled) return;
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
      // Small delay so the user isn't slammed the moment they touch the page.
      setTimeout(() => !cancelled && setArmed(true), 800);
      cleanup();
    };
    const opts = { once: true, capture: true } as const;
    const cleanup = () => {
      window.removeEventListener("click", fire, opts);
      window.removeEventListener("keydown", fire, opts);
      window.removeEventListener("scroll", fire, opts);
      window.removeEventListener("touchstart", fire, opts);
    };
    window.addEventListener("click", fire, opts);
    window.addEventListener("keydown", fire, opts);
    window.addEventListener("scroll", fire, opts);
    window.addEventListener("touchstart", fire, opts);

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [cfg.enabled]);

  // Countdown to enable close button
  useEffect(() => {
    if (!armed) return;
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [armed, secondsLeft]);

  // Lock body scroll while interstitial is up
  useEffect(() => {
    if (!armed) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [armed]);

  if (!cfg.enabled || !armed) return null;
  const closeable = secondsLeft <= 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sponsored content"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-3xl bg-card border border-border/80 rounded-xl overflow-hidden shadow-2xl">
        {/* Close / countdown */}
        <div className="absolute top-3 right-3 z-10">
          {closeable ? (
            <button
              type="button"
              onClick={() => setArmed(false)}
              aria-label="Close ad"
              className="w-9 h-9 rounded-full bg-background/90 hover:bg-background text-foreground flex items-center justify-center transition-colors shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div
              aria-live="polite"
              className="px-3 h-9 rounded-full bg-background/90 text-foreground text-xs font-mono flex items-center justify-center shadow-lg select-none"
            >
              Skip in {secondsLeft}s
            </div>
          )}
        </div>

        {/* Sponsored label */}
        <p className="absolute top-3 left-3 z-10 px-2 py-1 rounded bg-background/90 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
          Sponsored
        </p>

        {/* Ad creative */}
        {cfg.iframeSrc ? (
          <iframe
            src={cfg.iframeSrc}
            title="Sponsored content"
            className="w-full h-[70vh] border-0 bg-white"
            // Deliberately NOT using `allow-same-origin` — combined with
            // `allow-scripts` it lets the framed ad escape the sandbox by
            // accessing parent storage/cookies if it ever loads same-origin
            // content. Ad-network creatives are cross-origin and don't need
            // it.
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
          />
        ) : cfg.htmlSnippet ? (
          <div
            className="w-full min-h-[60vh] flex items-center justify-center p-8 bg-white text-black"
            dangerouslySetInnerHTML={{ __html: cfg.htmlSnippet }}
          />
        ) : (
          <div className="w-full min-h-[60vh] flex items-center justify-center p-8 text-center text-muted-foreground">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-primary mb-2">
                Interstitial placeholder
              </p>
              <p>
                Configure <code className="text-primary">interstitial.iframeSrc</code>{" "}
                or <code className="text-primary">interstitial.htmlSnippet</code>{" "}
                in <code className="text-primary">src/config/adNetworks.ts</code>.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
