import { useEffect, useRef } from "react";
import { AD_NETWORKS } from "@/config/adNetworks";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export type AdProvider = "adsense" | "adsterra" | "custom";

interface AdSlotProps {
  /** Logical name for the slot (used for analytics / debugging). */
  slot: string;
  /**
   * Which network renders this slot. Defaults to whichever banner network
   * is enabled in `adNetworks.ts` (AdSense wins if both are enabled).
   */
  provider?: AdProvider;
  /** Display size hint. `leaderboard` is 728x90, `rectangle` is 300x250. */
  format?: "leaderboard" | "rectangle" | "responsive";
  /**
   * Network-specific overrides:
   *   - adsterra: `zoneKey` overrides AD_NETWORKS.adsterra.banner.key
   *   - custom:   `customHtml` injects an arbitrary `<script>` tag inline
   */
  zoneKey?: string;
  customHtml?: string;
  className?: string;
}

function pickProvider(): AdProvider {
  if (AD_NETWORKS.adsense.enabled) return "adsense";
  if (AD_NETWORKS.adsterra.enabled && AD_NETWORKS.adsterra.banner) return "adsterra";
  return "adsense"; // placeholder fallback
}

export function AdSlot({
  slot,
  provider,
  format = "responsive",
  zoneKey,
  customHtml,
  className = "",
}: AdSlotProps) {
  const resolved = provider ?? pickProvider();
  const dims =
    format === "leaderboard"
      ? { minHeight: 90, maxWidth: 728 }
      : format === "rectangle"
      ? { minHeight: 250, maxWidth: 300 }
      : { minHeight: 90, maxWidth: 970 };

  return (
    <aside
      className={`my-8 flex flex-col items-center ${className}`}
      aria-label="Advertisement"
      data-ad-slot={slot}
      data-ad-provider={resolved}
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50 font-mono mb-2">
        Advertisement
      </p>
      <div
        className="w-full bg-card/30 border border-dashed border-border/50 rounded-md flex items-center justify-center text-xs text-muted-foreground/40 overflow-hidden"
        style={{ minHeight: dims.minHeight, maxWidth: dims.maxWidth }}
      >
        {resolved === "adsense" && (
          <AdSenseUnit slot={slot} minHeight={dims.minHeight} />
        )}
        {resolved === "adsterra" && (
          <AdsterraUnit
            slot={slot}
            zoneKey={zoneKey ?? AD_NETWORKS.adsterra.banner?.key ?? ""}
            width={AD_NETWORKS.adsterra.banner?.width ?? 728}
            height={AD_NETWORKS.adsterra.banner?.height ?? 90}
          />
        )}
        {resolved === "custom" && customHtml && (
          <CustomUnit slot={slot} html={customHtml} />
        )}
      </div>
    </aside>
  );
}

function AdSenseUnit({ slot, minHeight }: { slot: string; minHeight: number }) {
  const ref = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);
  useEffect(() => {
    // Guard against React StrictMode double-effect in dev — AdSense logs an
    // error when the same <ins> tag is push()'d twice.
    if (pushedRef.current) return;
    pushedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* AdSense bootstrap not loaded yet — placeholder mode. */
    }
  }, []);
  return (
    <ins
      ref={ref}
      className="adsbygoogle"
      style={{ display: "block", width: "100%", minHeight }}
      data-ad-client={AD_NETWORKS.adsense.publisherId}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

function AdsterraUnit({
  slot,
  zoneKey,
  width,
  height,
}: {
  slot: string;
  zoneKey: string;
  width: number;
  height: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!containerRef.current || !zoneKey) return;
    const container = containerRef.current;
    // Adsterra banners require the options var to be set globally before
    // their invoke.js loads. Each instance gets a unique global slot.
    const optsName = `atOptions_${slot.replace(/[^a-zA-Z0-9]/g, "_")}`;
    (window as unknown as Record<string, unknown>)[optsName] = {
      key: zoneKey,
      format: "iframe",
      height,
      width,
      params: {},
    };
    const optScript = document.createElement("script");
    optScript.text = `var atOptions = window['${optsName}'];`;
    container.appendChild(optScript);
    const invoke = document.createElement("script");
    invoke.async = true;
    invoke.src = `//www.profitableratecpm.com/${zoneKey}/invoke.js`;
    container.appendChild(invoke);
    return () => {
      container.innerHTML = "";
    };
  }, [slot, zoneKey, width, height]);
  return <div ref={containerRef} style={{ width, height }} />;
}

function CustomUnit({ slot, html }: { slot: string; html: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = html;
    // Re-execute any <script> tags inside the snippet (innerHTML doesn't run them).
    containerRef.current.querySelectorAll("script").forEach((old) => {
      const fresh = document.createElement("script");
      for (const a of Array.from(old.attributes)) {
        fresh.setAttribute(a.name, a.value);
      }
      fresh.text = old.text;
      old.parentNode?.replaceChild(fresh, old);
    });
  }, [html]);
  return <div ref={containerRef} data-custom-ad-slot={slot} />;
}
