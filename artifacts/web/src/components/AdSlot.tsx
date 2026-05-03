import { useEffect, useRef } from "react";

interface AdSlotProps {
  /** Logical name for the slot (used for analytics / debugging). */
  slot: string;
  /** Display size hint. `leaderboard` is 728x90, `rectangle` is 300x250, `responsive` fills container width. */
  format?: "leaderboard" | "rectangle" | "responsive";
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Ad slot placeholder. Drop your AdSense (or other network) snippet
 * inside the inner `<ins>` tag — the surrounding shell handles label,
 * sizing, and lazy-trigger of `(adsbygoogle = window.adsbygoogle || []).push({})`.
 *
 * Replace `data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"` with your real
 * AdSense publisher ID once you have it, and add the AdSense bootstrap
 * script tag to `index.html`:
 *
 *   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
 *
 * Until then this renders a labeled placeholder so layout doesn't shift
 * once real ads ship.
 */
export function AdSlot({ slot, format = "responsive", className = "" }: AdSlotProps) {
  const ref = useRef<HTMLModElement | null>(null);
  const dims =
    format === "leaderboard"
      ? { minHeight: 90, maxWidth: 728 }
      : format === "rectangle"
      ? { minHeight: 250, maxWidth: 300 }
      : { minHeight: 90, maxWidth: 970 };

  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense bootstrap not loaded yet (placeholder mode) — that's fine.
    }
  }, []);

  return (
    <aside
      className={`my-8 flex flex-col items-center ${className}`}
      aria-label="Advertisement"
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50 font-mono mb-2">
        Advertisement
      </p>
      <div
        className="w-full bg-card/30 border border-dashed border-border/50 rounded-md flex items-center justify-center text-xs text-muted-foreground/40"
        style={{ minHeight: dims.minHeight, maxWidth: dims.maxWidth }}
      >
        <ins
          ref={ref}
          className="adsbygoogle"
          style={{
            display: "block",
            width: "100%",
            minHeight: dims.minHeight,
          }}
          data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </aside>
  );
}
