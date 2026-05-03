import { type ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight, Lightbulb, ArrowRight, HelpCircle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { AdSlot } from "@/components/AdSlot";
import {
  useSEO,
  useJsonLd,
  breadcrumbLd,
  howToLd,
  faqLd,
  SITE_NAME,
} from "@/lib/seo";

export interface GuideStep {
  name: string;
  text: string;
  detail?: ReactNode; // richer JSX for the rendered step
}

export interface GuideFaq {
  q: string;
  a: string;
}

export interface RelatedGuide {
  href: string;
  title: string;
  description: string;
}

interface GuideLayoutProps {
  /** URL path of this guide, e.g. "/guides/save-chatgpt-as-pdf". */
  path: string;
  /** Page <title> (without site name suffix). */
  title: string;
  /** SEO meta description (~155 chars). */
  description: string;
  keywords?: string;
  /** Eyebrow tag shown above the H1. */
  eyebrow?: string;
  /** H1 of the article (can differ from <title>). */
  heading: string;
  /** Direct, scannable answer for AI Overviews and featured snippets. */
  tldr: string;
  /** Optional pillar this guide reports up to. */
  pillar?: { href: string; title: string };
  /** Steps — also used to generate HowTo JSON-LD. */
  howTo: {
    name: string;
    description: string;
    totalTime?: string;
    steps: GuideStep[];
  };
  /** Optional FAQ section — also used to generate FAQPage JSON-LD. */
  faqs?: GuideFaq[];
  /** Sibling guides to interlink. */
  related: RelatedGuide[];
  /** Additional sections (rendered between steps and FAQs). */
  children?: ReactNode;
}

export function GuideLayout({
  path,
  title,
  description,
  keywords,
  eyebrow = "GUIDE",
  heading,
  tldr,
  pillar,
  howTo,
  faqs,
  related,
  children,
}: GuideLayoutProps) {
  useSEO({
    title,
    description,
    path,
    keywords,
    type: "article",
  });

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides" },
    { name: title, path },
  ];

  useJsonLd(`breadcrumb-${path}`, breadcrumbLd(crumbs));
  useJsonLd(
    `howto-${path}`,
    howToLd({
      name: howTo.name,
      description: howTo.description,
      totalTime: howTo.totalTime,
      steps: howTo.steps.map((s) => ({ name: s.name, text: s.text })),
    }),
  );
  useJsonLd(`faq-${path}`, faqs && faqs.length > 0 ? faqLd(faqs) : null);

  return (
    <Layout>
      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-xs text-muted-foreground mb-6 font-mono"
        >
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <span key={c.path} className="flex items-center gap-1">
                {last ? (
                  <span className="text-foreground/80 truncate max-w-[200px]">
                    {c.name}
                  </span>
                ) : (
                  <Link
                    href={c.path}
                    className="hover:text-primary transition-colors"
                  >
                    {c.name}
                  </Link>
                )}
                {!last && <ChevronRight className="w-3 h-3 opacity-50" />}
              </span>
            );
          })}
        </nav>

        {/* Header */}
        <header className="space-y-4 mb-8">
          <p className="text-xs font-mono uppercase tracking-wider text-primary">
            {eyebrow}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            {heading}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {description}
          </p>
        </header>

        {/* TL;DR — direct answer for AI Overviews */}
        <aside
          aria-label="Quick answer"
          className="bg-primary/10 border border-primary/30 rounded-xl p-5 mb-10"
        >
          <p className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-2">
            <Lightbulb className="w-3.5 h-3.5" />
            Quick answer
          </p>
          <p className="text-foreground leading-relaxed">{tldr}</p>
        </aside>

        {/* Steps */}
        <section
          aria-labelledby="steps-heading"
          className="
            prose prose-invert max-w-none
            prose-headings:text-foreground prose-headings:tracking-tight
            prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
            prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
            prose-p:text-muted-foreground prose-p:leading-relaxed
            prose-li:text-muted-foreground
            prose-strong:text-foreground
            prose-a:text-primary hover:prose-a:underline
            prose-code:text-primary prose-code:before:content-none prose-code:after:content-none
          "
        >
          <h2 id="steps-heading">{howTo.name}</h2>
          <ol className="not-prose space-y-6 mt-4">
            {howTo.steps.map((s, i) => (
              <li
                key={i}
                className="flex gap-4 items-start"
                itemProp="step"
                itemScope
                itemType="https://schema.org/HowToStep"
              >
                <span
                  className="shrink-0 w-8 h-8 rounded-full bg-primary/20 border border-primary/40 text-primary text-sm font-bold flex items-center justify-center mt-0.5"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div className="space-y-2 min-w-0">
                  <h3
                    className="text-lg font-semibold text-foreground m-0"
                    itemProp="name"
                  >
                    {s.name}
                  </h3>
                  <div
                    className="text-muted-foreground leading-relaxed [&_a]:text-primary [&_a:hover]:underline [&_strong]:text-foreground [&_code]:text-primary [&_code]:font-mono [&_code]:text-sm [&_p]:my-2"
                    itemProp="text"
                  >
                    {s.detail ?? <p>{s.text}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <AdSlot slot={`guide-mid-${path.replace(/\//g, "-")}`} format="leaderboard" />

          {children}

          {/* Pillar callout */}
          {pillar && (
            <aside className="not-prose my-12 p-5 rounded-xl border border-border/60 bg-card/40 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  Part of a bigger guide
                </p>
                <p className="text-foreground font-medium">{pillar.title}</p>
              </div>
              <Link
                href={pillar.href}
                className="shrink-0 inline-flex items-center gap-1 text-sm text-primary hover:underline whitespace-nowrap"
              >
                Read pillar <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </aside>
          )}

          {/* FAQs */}
          {faqs && faqs.length > 0 && (
            <section aria-labelledby="faq-heading" className="not-prose mt-14">
              <h2
                id="faq-heading"
                className="text-2xl font-bold text-foreground tracking-tight mb-2 flex items-center gap-2"
              >
                <HelpCircle className="w-5 h-5 text-primary" />
                Frequently asked
              </h2>
              <dl className="divide-y divide-border/60 border-y border-border/60">
                {faqs.map((f, i) => (
                  <div key={i} className="py-5">
                    <dt className="text-foreground font-semibold mb-2">{f.q}</dt>
                    <dd className="text-muted-foreground leading-relaxed">
                      {f.a}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Related guides */}
          {related.length > 0 && (
            <section
              aria-labelledby="related-heading"
              className="not-prose mt-14"
            >
              <h2
                id="related-heading"
                className="text-2xl font-bold text-foreground tracking-tight mb-5"
              >
                Related guides
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {related.map((r) => (
                  <li key={r.href}>
                    <Link
                      href={r.href}
                      className="block p-4 rounded-lg border border-border/60 bg-card/40 hover:border-primary/40 hover:bg-card/80 transition-colors"
                    >
                      <p className="text-foreground font-medium mb-1">{r.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {r.description}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* CTA */}
          <aside className="not-prose mt-14 p-6 rounded-xl border border-primary/40 bg-primary/5 text-center">
            <p className="text-xl font-bold text-foreground mb-2">
              Ready to extract a chat?
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Free, instant, no signup. Works with all major AI platforms.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
            >
              Try {SITE_NAME} <ArrowRight className="w-4 h-4" />
            </Link>
          </aside>
        </section>
      </main>
    </Layout>
  );
}
