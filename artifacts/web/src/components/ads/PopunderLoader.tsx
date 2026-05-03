import { useEffect } from "react";
import { AD_NETWORKS } from "@/config/adNetworks";
import { ScriptInjector } from "./ScriptInjector";

const SESSION_KEY = "popunder-fired";

/**
 * Loads any enabled popunder networks. Each network's bootstrap script
 * handles the actual popunder open on first user gesture — we just inject
 * the script. We mark a sessionStorage flag so we don't re-inject on
 * route changes (the scripts themselves are also idempotent, but this
 * keeps the network panel impressions clean).
 *
 * Note: only ONE popunder will ever actually fire per user gesture
 * because browsers enforce one-popup-per-gesture. If you enable multiple
 * networks here, they will compete for the click — stick to one for
 * predictable revenue.
 */
export function PopunderLoader() {
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Private mode / disabled storage — fine, the network scripts handle dedup.
    }
  }, []);

  return (
    <>
      {AD_NETWORKS.adsterra.enabled && AD_NETWORKS.adsterra.popunder?.src && (
        <ScriptInjector
          id="adsterra-popunder"
          src={AD_NETWORKS.adsterra.popunder.src}
          waitForUserGesture
          attributes={{ "data-cfasync": "false" }}
        />
      )}

      {AD_NETWORKS.propellerAds.enabled &&
        AD_NETWORKS.propellerAds.popunderZoneId && (
          <ScriptInjector
            id="propellerads-popunder"
            src={`//cdn.propellerads.com/onclick/${AD_NETWORKS.propellerAds.popunderZoneId}.js`}
            waitForUserGesture
            attributes={{ "data-cfasync": "false" }}
          />
        )}

      {AD_NETWORKS.popAds.enabled && AD_NETWORKS.popAds.siteId && (
        <ScriptInjector
          id="popads-popunder"
          waitForUserGesture
          inline={`(function(){var s=document.createElement('script');s.type='text/javascript';s.async=true;s.src='//c1.popads.net/pop.js';s.setAttribute('data-cfasync','false');var p=document.getElementsByTagName('script')[0];p.parentNode.insertBefore(s,p);window._pop=window._pop||[];window._pop.push(['siteId','${AD_NETWORKS.popAds.siteId}']);window._pop.push(['minBid','0']);window._pop.push(['popundersPerIP','0']);window._pop.push(['delayBetween','0']);window._pop.push(['default',false]);window._pop.push(['defaultPerDay','0']);window._pop.push(['topmostLayer','auto']);})();`}
        />
      )}

      {AD_NETWORKS.custom.enabled &&
        AD_NETWORKS.custom.scripts.map((s) => (
          <ScriptInjector
            key={s.id}
            id={s.id}
            src={s.src}
            async={s.async ?? true}
            defer={s.defer ?? false}
            waitForUserGesture
          />
        ))}
    </>
  );
}
