import { useEffect } from "react";

export const SITE_URL = "https://chatextractor.replit.app";
export const SITE_NAME = "ChatScribe";
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

/**
 * Inject a JSON-LD <script> tag into <head> with a stable id, and clean
 * it up on unmount. Use this for HowTo, FAQPage, BreadcrumbList, etc.
 */
export function useJsonLd(id: string, data: object | object[] | null | undefined) {
  const serialized = data ? JSON.stringify(data) : "";
  useEffect(() => {
    if (!serialized) return;
    document.getElementById(id)?.remove();
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    el.text = serialized;
    document.head.appendChild(el);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [id, serialized]);
}

/** Build a BreadcrumbList JSON-LD from an ordered list of crumbs. */
export function breadcrumbLd(crumbs: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.path === "/" ? "" : c.path}`,
    })),
  };
}

/** Build a HowTo JSON-LD from a list of step objects. */
export function howToLd(opts: {
  name: string;
  description: string;
  totalTime?: string; // ISO 8601 duration, e.g. "PT2M"
  steps: { name: string; text: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: opts.name,
    description: opts.description,
    ...(opts.totalTime ? { totalTime: opts.totalTime } : {}),
    step: opts.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

/** Build a FAQPage JSON-LD from a list of Q&A pairs. */
export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
