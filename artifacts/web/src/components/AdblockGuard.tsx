import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Heart, ShieldAlert, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE_NAME } from "@/lib/seo";

declare global {
  interface Window {
    canRunAds?: boolean;
    adsLoaded?: boolean;
  }
}

/**
 * Multi-signal ad-blocker detector. We fire several independent probes
 * and treat the user as blocked if ANY of them trip:
 *
 *  1. `window.canRunAds` flag — set by the inline `/ads.js` script in
 *     index.html. uBlock / Adblock Plus / Brave / AdGuard all block
 *     `/ads.js` by default per EasyList, so the flag never gets set.
 *
 *  2. Network fetch of `/ads.js` — if the request errors (network
 *     interception) or returns a non-OK status, blocked.
 *
 *  3. DOM bait element — a hidden div with classnames the major
 *     filter lists hide (`ad-banner`, `adsbox`, `doubleclick`,
 *     `pub_300x250`, `carbon-ads`, `adsbygoogle`). If the element is
 *     hidden, removed, or zero-sized after insertion, blocked.
 *
 *  4. Bait <ins class="adsbygoogle"> — Google AdSense's real tag.
 *     uBlock cosmetically hides this even before AdSense loads.
 *
 *  5. Bait image at an ad-named path (`/ads/banner.gif`). Many
 *     blockers refuse the request entirely.
 *
 * Re-runs every 4 seconds so re-enabling the blocker mid-session is
 * also caught.
 */
async function detectAdblock(): Promise<boolean> {
  // (1) Flag check
  if (window.canRunAds !== true || window.adsLoaded !== true) {
    return true;
  }

  // (2) Network fetch of bait script
  try {
    const r = await fetch(`/ads.js?_=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return true;
    const text = await r.text();
    if (!text.includes("canRunAds")) return true;
  } catch {
    return true;
  }

  // (3) DOM bait element — wait a tick so cosmetic-filter rules apply
  const bait = document.createElement("div");
  bait.className =
    "ad-banner ads adsbox ad-placement doubleclick pub_300x250 carbon-ads adsbygoogle";
  bait.id = "ad-bait-detector";
  bait.setAttribute("data-ad-slot", "1234567890");
  bait.style.cssText =
    "position:absolute !important;left:-9999px !important;top:-9999px !important;height:60px !important;width:300px !important;display:block !important;visibility:visible !important;opacity:1 !important;pointer-events:none;";
  bait.innerHTML = "&nbsp;";
  document.body.appendChild(bait);
  await new Promise((r) => setTimeout(r, 120));
  const cs = window.getComputedStyle(bait);
  const baitBlocked =
    !document.body.contains(bait) ||
    bait.offsetParent === null ||
    bait.offsetHeight === 0 ||
    bait.offsetWidth === 0 ||
    bait.clientHeight === 0 ||
    cs.display === "none" ||
    cs.visibility === "hidden" ||
    cs.opacity === "0";
  bait.remove();
  if (baitBlocked) return true;

  // (4) Real AdSense <ins> tag — uBlock cosmetic filters hide this
  const ins = document.createElement("ins");
  ins.className = "adsbygoogle";
  ins.setAttribute("data-ad-client", "ca-pub-0000000000000000");
  ins.setAttribute("data-ad-slot", "1234567890");
  ins.style.cssText =
    "position:absolute !important;left:-9999px !important;top:-9999px !important;display:block !important;height:50px !important;width:320px !important;";
  document.body.appendChild(ins);
  await new Promise((r) => setTimeout(r, 80));
  const ics = window.getComputedStyle(ins);
  const insBlocked =
    !document.body.contains(ins) ||
    ins.offsetParent === null ||
    ins.offsetHeight === 0 ||
    ics.display === "none" ||
    ics.visibility === "hidden";
  ins.remove();
  if (insBlocked) return true;

  // (5) Image at ad-pattern URL
  const imgBlocked = await new Promise<boolean>((resolve) => {
    const img = new Image();
    const t = setTimeout(() => resolve(true), 1500);
    img.onload = () => {
      clearTimeout(t);
      resolve(false);
    };
    img.onerror = () => {
      clearTimeout(t);
      resolve(true);
    };
    // Same-origin ad-named asset; we don't actually serve a gif here,
    // so a non-blocked browser will hit our 404 handler and fire onerror
    // too. Therefore only treat this as a positive *blocker* signal when
    // the request is actively refused (no response). To distinguish, we
    // race against a parallel fetch:
    img.src = `/ads/banner.gif?_=${Date.now()}`;
  });
  if (imgBlocked) {
    // Confirm with a fetch — if fetch also fails with TypeError, that's
    // a real block (browser refused the request before it left).
    try {
      await fetch(`/ads/banner.gif?_=${Date.now()}`, { cache: "no-store" });
      // 404 is fine; the request went through.
    } catch {
      return true;
    }
  }

  return false;
}

export function AdblockGuard({ children }: { children: ReactNode }) {
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [firstCheckDone, setFirstCheckDone] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const runCheck = useCallback(async () => {
    setChecking(true);
    const isBlocked = await detectAdblock();
    setBlocked(isBlocked);
    setChecking(false);
    setFirstCheckDone(true);
  }, []);

  // Initial check + recurring sweep
  useEffect(() => {
    runCheck();
    intervalRef.current = window.setInterval(runCheck, 4000);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [runCheck]);

  // Lock body scroll while overlay is up
  useEffect(() => {
    if (blocked) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [blocked]);

  // Re-check on window focus (user switches to ad-blocker settings tab)
  useEffect(() => {
    const onFocus = () => runCheck();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [runCheck]);

  return (
    <>
      {children}
      {firstCheckDone && blocked && <AdblockOverlay onRetry={runCheck} checking={checking} />}
    </>
  );
}

function AdblockOverlay({
  onRetry,
  checking,
}: {
  onRetry: () => void;
  checking: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="adblock-title"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-background/95 backdrop-blur-md"
      style={{ pointerEvents: "auto" }}
    >
      <div className="max-w-lg w-full bg-card border border-border/80 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
        <div className="px-8 pt-8 pb-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 blur-lg rounded-full" />
              <ShieldAlert className="w-9 h-9 text-primary relative" />
            </div>
            <h2
              id="adblock-title"
              className="text-2xl font-bold text-white tracking-tight"
            >
              Please disable your ad blocker
            </h2>
          </div>

          <p className="text-muted-foreground leading-relaxed">
            <strong className="text-white">{SITE_NAME}</strong> is, and always
            will be, <strong className="text-white">100% free</strong>. No
            signup. No paywall. No premium tier.
          </p>

          <p className="text-muted-foreground leading-relaxed">
            We pay for the servers, the bandwidth, and the constant parser
            updates that keep this tool working{" "}
            <strong className="text-white">entirely through ads</strong>. When
            you block them, you quietly make it impossible for us to keep this
            free for the next person who needs it.
          </p>

          <p className="text-muted-foreground leading-relaxed">
            We're a small, independent team building something we genuinely
            love. A few visible ads is the only thing standing between this
            tool existing and not existing. Please consider letting them
            through — just for us.
          </p>

          <div className="bg-secondary/40 border border-border/60 rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              How to help in 10 seconds
            </p>
            <ul className="space-y-1.5 text-muted-foreground list-disc list-inside marker:text-primary">
              <li>
                Click your ad blocker icon and choose{" "}
                <span className="text-white font-medium">
                  "Pause on this site"
                </span>
              </li>
              <li>
                Or whitelist this domain in your blocker's settings
              </li>
              <li>Then click the button below to continue</li>
            </ul>
          </div>
        </div>

        <div className="px-8 pb-8 space-y-3">
          <Button
            onClick={onRetry}
            disabled={checking}
            className="w-full text-base font-semibold py-6 gap-2"
          >
            {checking ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Checking…
              </>
            ) : (
              <>
                <Heart className="w-4 h-4" /> I've disabled it — let me in
              </>
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Thank you for keeping independent tools alive ❤️
          </p>
        </div>
      </div>
    </div>
  );
}
