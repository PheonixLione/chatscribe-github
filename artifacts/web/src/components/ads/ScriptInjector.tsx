import { useEffect } from "react";

interface ScriptInjectorProps {
  /** Stable id so we don't double-inject across remounts. */
  id: string;
  /** Script src URL. Omit when using `inline`. */
  src?: string;
  async?: boolean;
  defer?: boolean;
  /** Inline JS body to inject as the script's text content (no src). */
  inline?: string;
  /** Arbitrary HTML attributes (e.g. data-cfasync="false"). */
  attributes?: Record<string, string>;
  /** If true, wait for first user interaction (click/scroll/keydown)
   *  before injecting. Required for popunder / popup networks that need
   *  a user gesture to bypass popup blockers. */
  waitForUserGesture?: boolean;
}

/**
 * Generic third-party script injector. Renders nothing; side-effect only.
 * Used for ad-network bootstrap scripts (Adsterra, PropellerAds, PopAds,
 * HilltopAds, etc.) and for any other vendor snippet.
 */
export function ScriptInjector({
  id,
  src,
  async = true,
  defer = false,
  inline,
  attributes = {},
  waitForUserGesture = false,
}: ScriptInjectorProps) {
  useEffect(() => {
    let cancelled = false;
    let cleanupGesture: (() => void) | null = null;

    const inject = () => {
      if (cancelled || document.getElementById(id)) return;
      const el = document.createElement("script");
      el.id = id;
      if (src) el.src = src;
      if (async) el.async = true;
      if (defer) el.defer = true;
      if (inline) el.text = inline;
      for (const [k, v] of Object.entries(attributes)) el.setAttribute(k, v);
      document.head.appendChild(el);
    };

    if (waitForUserGesture) {
      const fire = () => {
        cleanupGesture?.();
        inject();
      };
      const opts = { once: true, capture: true } as const;
      window.addEventListener("click", fire, opts);
      window.addEventListener("keydown", fire, opts);
      window.addEventListener("scroll", fire, opts);
      window.addEventListener("touchstart", fire, opts);
      cleanupGesture = () => {
        window.removeEventListener("click", fire, opts);
        window.removeEventListener("keydown", fire, opts);
        window.removeEventListener("scroll", fire, opts);
        window.removeEventListener("touchstart", fire, opts);
      };
    } else {
      inject();
    }

    return () => {
      cancelled = true;
      cleanupGesture?.();
    };
  }, [id, src, async, defer, inline, waitForUserGesture, JSON.stringify(attributes)]);

  return null;
}
