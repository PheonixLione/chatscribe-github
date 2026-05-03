/**
 * Central configuration for every ad network that ships on this site.
 *
 * To enable a network, fill in its credentials below and flip `enabled: true`.
 * To disable a network, set `enabled: false` (no need to remove the config).
 *
 * The site is *designed* to run multiple networks simultaneously — Google
 * AdSense for in-content banners, Adsterra/PropellerAds for popunder &
 * social-bar, PopAds as a fallback popunder, etc. There are caveats — see
 * the "Compatibility" notes at the bottom of this file.
 */

export interface AdSenseConfig {
  enabled: boolean;
  /** ca-pub-XXXXXXXXXXXXXXXX from your AdSense dashboard. */
  publisherId: string;
}

export interface AdsterraConfig {
  enabled: boolean;
  /** Banner / native zone IDs (one per `<AdSlot provider="adsterra" zone="..."/>` instance). */
  banner?: { key: string; width: number; height: number };
  /** Native ad container ID + script URL from Adsterra dashboard. */
  native?: { key: string; src: string };
  /** Social bar (sticky bottom bar) script src. */
  socialBar?: { src: string };
  /** Popunder script src. */
  popunder?: { src: string };
}

export interface PropellerAdsConfig {
  enabled: boolean;
  /** OnClick popunder zone ID. */
  popunderZoneId?: string;
  /** Direct-link / interstitial zone URL. */
  interstitialUrl?: string;
}

export interface PopAdsConfig {
  enabled: boolean;
  /** Site ID from popads.net dashboard. */
  siteId?: string;
}

export interface CustomScriptConfig {
  enabled: boolean;
  /** Arbitrary <script> tags injected once on first user interaction.
   *  Use for any network not listed above. */
  scripts: { id: string; src: string; async?: boolean; defer?: boolean }[];
}

export interface AdNetworksConfig {
  adsense: AdSenseConfig;
  adsterra: AdsterraConfig;
  propellerAds: PropellerAdsConfig;
  popAds: PopAdsConfig;
  custom: CustomScriptConfig;
  /** Show a full-screen interstitial (with countdown) once per session. */
  interstitial: {
    enabled: boolean;
    /** Seconds the user must wait before the close button appears. */
    skipAfterSeconds: number;
    /** What to render inside the interstitial: an iframe URL (typically a
     *  direct-link / interstitial offer URL from PropellerAds, Adsterra,
     *  Monetag, etc.) or a custom HTML snippet. */
    iframeSrc?: string;
    htmlSnippet?: string;
  };
}

export const AD_NETWORKS: AdNetworksConfig = {
  adsense: {
    enabled: true,
    publisherId: "ca-pub-XXXXXXXXXXXXXXXX",
  },

  adsterra: {
    enabled: false,
    // banner: { key: "abc123def456...", width: 728, height: 90 },
    // native: { key: "abc123...", src: "//pl12345678.profitableratecpm.com/abc123/invoke.js" },
    // socialBar: { src: "//pl12345678.profitableratecpm.com/abcdef/invoke.js" },
    // popunder: { src: "//pl12345678.profitableratecpm.com/popunder.js" },
  },

  propellerAds: {
    enabled: false,
    // popunderZoneId: "1234567",
    // interstitialUrl: "https://propellerads.com/...",
  },

  popAds: {
    enabled: false,
    // siteId: "1234567",
  },

  custom: {
    enabled: false,
    scripts: [
      // { id: "hilltopads", src: "//hilltopads.com/...", async: true },
    ],
  },

  interstitial: {
    enabled: false,
    skipAfterSeconds: 5,
    // iframeSrc: "https://your-direct-link-from-adsterra-or-propellerads.com",
    // htmlSnippet: "<div>Custom HTML ad</div>",
  },
};

/**
 * Compatibility notes (read before enabling multiple networks):
 *
 * - **Google AdSense + popunder networks**: AdSense's content policies
 *   prohibit "interstitial ads that disrupt the user experience" and most
 *   popunder networks. Running both can get your AdSense account banned.
 *   Pick AdSense *or* aggressive networks like PopAds/Adsterra popunder —
 *   not both — for production.
 *
 * - **Multiple popunder networks**: only one popunder will ever fire per
 *   user gesture (browsers enforce this). The networks compete for the
 *   click. Stick to ONE popunder provider for predictable revenue.
 *
 * - **"Unskippable" interstitials**: there is no way to make a browser
 *   interstitial truly un-closeable — the user can always close the tab.
 *   What we *can* do is delay the close button by N seconds, which is
 *   what `interstitial.skipAfterSeconds` controls. Industry standard is
 *   5–15 seconds; longer values cause users to bounce.
 *
 * - **SEO / Core Web Vitals**: aggressive popunder & full-page
 *   interstitial ads can trigger Google's "intrusive interstitial"
 *   penalty and tank your search rankings. We mitigate this by:
 *     1. only firing the popunder/interstitial AFTER the first user
 *        interaction (so Googlebot, which doesn't click, never sees them);
 *     2. only firing once per session (sessionStorage flag).
 *   But understand the tradeoff: more aggressive ads = more revenue per
 *   visitor, fewer visitors over time.
 *
 * - **Brave / Safari / iOS**: many popunder / popup mechanisms are
 *   blocked by default in privacy-focused browsers. Don't budget revenue
 *   based purely on session count — track impressions per network in
 *   each network's dashboard.
 */
