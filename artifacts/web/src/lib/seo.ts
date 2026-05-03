import { useEffect } from "react";

export const SITE_URL = "https://chatextractor.replit.app";
export const SITE_NAME = "Chat Extractor";
export const SITE_TAGLINE =
  "Extract, read, and export any AI chat share link as Markdown, PDF, or text — free, no signup.";

export interface SEOOptions {
  title: string;
  description: string;
  path: string;
  keywords?: string;
  type?: "website" | "article";
  noindex?: boolean;
}

function setMeta(attr: "name" | "property", key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSEO(opts: SEOOptions) {
  useEffect(() => {
    const fullTitle =
      opts.title === SITE_NAME ? opts.title : `${opts.title} | ${SITE_NAME}`;
    const url = `${SITE_URL}${opts.path === "/" ? "" : opts.path}`;
    const ogImage = `${SITE_URL}/opengraph.jpg`;

    document.title = fullTitle;
    setMeta("name", "description", opts.description);
    if (opts.keywords) setMeta("name", "keywords", opts.keywords);
    setMeta("name", "robots", opts.noindex ? "noindex,nofollow" : "index,follow");
    setLink("canonical", url);

    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", opts.description);
    setMeta("property", "og:type", opts.type ?? "website");
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", ogImage);
    setMeta("property", "og:site_name", SITE_NAME);

    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", opts.description);
    setMeta("name", "twitter:image", ogImage);
  }, [opts.title, opts.description, opts.path, opts.keywords, opts.type, opts.noindex]);
}
