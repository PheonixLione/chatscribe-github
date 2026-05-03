import { AD_NETWORKS } from "@/config/adNetworks";
import { ScriptInjector } from "./ScriptInjector";

/**
 * Sticky bottom-bar ad (Adsterra "Social Bar" / PropellerAds "In-Page Push" /
 * similar). The network's bootstrap script renders the bar itself — we
 * just inject the loader.
 *
 * Loaded after the first user gesture so it doesn't block LCP.
 */
export function SocialBar() {
  if (!AD_NETWORKS.adsterra.enabled || !AD_NETWORKS.adsterra.socialBar?.src) {
    return null;
  }
  return (
    <ScriptInjector
      id="adsterra-social-bar"
      src={AD_NETWORKS.adsterra.socialBar.src}
      waitForUserGesture
      attributes={{ "data-cfasync": "false" }}
    />
  );
}
