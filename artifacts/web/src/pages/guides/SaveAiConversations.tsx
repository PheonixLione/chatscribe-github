import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { AdSlot } from "@/components/AdSlot";
import {
  useSEO,
  useJsonLd,
  breadcrumbLd,
  faqLd,
  SITE_NAME,
} from "@/lib/seo";
import { ChevronRight, Lightbulb, ArrowRight, BookOpen } from "lucide-react";

const SPOKES = [
  {
    href: "/guides/save-chatgpt-as-pdf",
    title: "Save a ChatGPT conversation as PDF",
    description:
      "Three reliable methods, including the cleanest one (Chat Extractor) for production-quality PDFs.",
  },
  {
    href: "/guides/export-claude-to-markdown",
    title: "Export a Claude conversation to Markdown",
    description:
      "Preserve code blocks, lists, and inline formatting from any Claude.ai share link.",
  },
  {
    href: "/guides/download-gemini-chat",
    title: "Download a Gemini (Google AI) chat",
    description:
      "Use Gemini's share button, then save the result as Markdown, PDF, or text.",
  },
  {
    href: "/guides/save-grok-conversation",
    title: "Save a Grok (xAI) conversation",
    description:
      "Grok shares are public but ephemeral. Archive them properly in under a minute.",
  },
  {
    href: "/guides/convert-ai-chat-to-markdown",
    title: "Convert any AI chat to Markdown",
    description:
      "A single platform-agnostic playbook covering all six major AI providers.",
  },
];

const FAQS = [
  {
    q: "Do AI chats really disappear?",
    a: "Yes. Free tiers of ChatGPT, Claude, and Gemini all rotate or delete conversation history under various conditions — account inactivity, retention windows for shared links, model migrations, or terms-of-service updates. Public share links can also be revoked by the original creator at any time.",
  },
  {
    q: "What's the safest format to archive an AI conversation in?",
    a: "Markdown. It's plain text, opens in any editor a decade from now, preserves headings and code blocks, and converts losslessly to HTML, PDF, DOCX, or any other format you might want later. PDF is good for legal or printable archives but harder to edit.",
  },
  {
    q: "Can I extract a chat that I haven't shared publicly?",
    a: "No. Chat Extractor only works with publicly shared URLs. To save a private conversation, first generate a share link inside the AI platform, then paste that link into Chat Extractor.",
  },
  {
    q: "Will the formatting survive the export?",
    a: "Yes. We preserve headings, bullet lists, numbered lists, code blocks (with language tags), inline code, bold, italic, links, and tables. The output looks essentially identical to the source page.",
  },
  {
    q: "Do you store the conversations I extract?",
    a: "No. Every request is processed in memory and discarded. We don't save the share URL, the parsed conversation, or any user-identifying metadata.",
  },
];

export default function SaveAiConversations() {
  useSEO({
    title:
      "How to save AI conversations: the complete guide (ChatGPT, Claude, Gemini, Grok)",
    description:
      "Why AI chats disappear, the fastest way to save them, and how to build a permanent searchable archive across every major AI platform. Updated 2026.",
    path: "/guides/save-ai-conversations",
    keywords:
      "save ai conversation, archive chatgpt, export claude chat, save gemini chat, ai chat backup, save ai chat permanently, ai conversation archive",
    type: "article",
  });

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides" },
    { name: "Save AI conversations", path: "/guides/save-ai-conversations" },
  ];
  useJsonLd("breadcrumb-pillar", breadcrumbLd(crumbs));
  useJsonLd("faq-pillar", faqLd(FAQS));
  useJsonLd("article-pillar", {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "How to save AI conversations: the complete guide (ChatGPT, Claude, Gemini, Grok)",
    description:
      "Why AI chats disappear, the fastest way to save them, and how to build a permanent searchable archive across every major AI platform.",
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: "https://chatextractor.replit.app/favicon.svg",
      },
    },
    mainEntityOfPage: "https://chatextractor.replit.app/guides/save-ai-conversations",
  });

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
                  <span className="text-foreground/80 truncate max-w-[260px]">
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

        <header className="space-y-4 mb-8">
          <p className="text-xs font-mono uppercase tracking-wider text-primary flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5" />
            PILLAR GUIDE
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            How to save AI conversations
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            A complete, regularly-updated guide to keeping a permanent copy of
            your most important AI chats across ChatGPT, Claude, Gemini, Grok,
            Perplexity, and DeepSeek.
          </p>
        </header>

        {/* TL;DR */}
        <aside
          aria-label="Quick answer"
          className="bg-primary/10 border border-primary/30 rounded-xl p-5 mb-10"
        >
          <p className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-2">
            <Lightbulb className="w-3.5 h-3.5" />
            Quick answer
          </p>
          <p className="text-foreground leading-relaxed">
            The fastest way to save any AI conversation: use the platform's
            built-in <strong>Share</strong> button to create a public link,
            paste that link into <strong>{SITE_NAME}</strong>, and download
            the result as Markdown, PDF, or plain text. This works for
            ChatGPT, Claude, Gemini, Grok, Perplexity, and DeepSeek, takes
            under 30 seconds, and preserves all formatting.
          </p>
        </aside>

        <article
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
          <h2>Why AI conversations disappear</h2>
          <p>
            Most people assume their AI chat history is permanent. It isn't.
            Here's what actually happens to the conversations sitting in your
            account right now:
          </p>
          <ul>
            <li>
              <strong>Account-side rotation.</strong> Free tiers of ChatGPT,
              Claude, and Gemini all impose silent retention windows on
              inactive accounts. Conversations older than ~30 days on inactive
              accounts can vanish without warning.
            </li>
            <li>
              <strong>Share-link expiry.</strong> Public share URLs are
              revocable at any time by the creator and by the platform. A
              link that works today may 404 next month.
            </li>
            <li>
              <strong>Model migrations.</strong> When a provider deprecates a
              model, conversations bound to that model can become read-only,
              non-shareable, or unreachable from new clients.
            </li>
            <li>
              <strong>Terms-of-service updates.</strong> Several major
              providers have, in 2024–2025, retroactively deleted
              conversations that violated newly-clarified content policies.
            </li>
            <li>
              <strong>Account deletion or suspension.</strong> Lose access to
              the account and you lose every conversation in it.
            </li>
          </ul>
          <p>
            If a conversation matters — for work, for research, for legal
            documentation, or just because it's good — you should keep your
            own copy.
          </p>

          <AdSlot slot="pillar-mid-1" format="leaderboard" />

          <h2>The three approaches (and what's wrong with the first two)</h2>

          <h3>1. Screenshots</h3>
          <p>
            Easy and immediate, but the result is an image — not searchable,
            not editable, not copy-pasteable, and frequently truncated. Long
            conversations require dozens of stitched screenshots. Use this
            only as a last resort.
          </p>

          <h3>2. Browser print-to-PDF</h3>
          <p>
            Better than screenshots — produces a real document with selectable
            text — but the formatting is usually mangled. AI chat UIs aren't
            print-stylesheet-friendly: code blocks overflow, sidebars get
            included, message avatars repeat, and pagination breaks
            mid-thought.
          </p>

          <h3>3. Share-link extraction (recommended)</h3>
          <p>
            Use the AI platform's own <strong>Share</strong> action to
            generate a public link, then run that link through{" "}
            <Link href="/">{SITE_NAME}</Link>. Behind the scenes we fetch
            the public page, parse the conversation structure, and emit clean
            Markdown — which converts losslessly to PDF, plain text, or
            anything else. This is the only approach that consistently
            preserves formatting across every platform.
          </p>

          <h2>Step-by-step: the share-link method</h2>
          <ol>
            <li>
              <strong>Open the conversation</strong> in the AI tool you're
              using (ChatGPT, Claude, Gemini, Grok, Perplexity, or DeepSeek).
            </li>
            <li>
              <strong>Click the share button.</strong> Every major platform
              has one — usually a "Share" icon in the conversation header or
              an entry in the message-overflow menu.
            </li>
            <li>
              <strong>Copy the public URL</strong> the platform generates.
            </li>
            <li>
              <strong>Paste it into <Link href="/">{SITE_NAME}</Link></strong>{" "}
              and click <em>Extract</em>.
            </li>
            <li>
              <strong>Download</strong> as Markdown (best for archives), PDF
              (best for sharing or printing), or plain text.
            </li>
          </ol>

          <h2>Choosing the right export format</h2>
          <p>
            All three formats are produced from the same parsed conversation,
            so the underlying text is identical. The format matters for what
            you'll do with the file later:
          </p>
          <ul>
            <li>
              <strong>Markdown</strong> — the best long-term archive format.
              Plain text, opens in any editor, preserves headings and code
              blocks, paste-ready for Notion, Obsidian, GitHub, and most
              note-taking tools. Converts losslessly to anything else later.
            </li>
            <li>
              <strong>PDF</strong> — best for legal records, sharing with
              non-technical recipients, or printing. Preserves visual
              formatting but is harder to edit.
            </li>
            <li>
              <strong>Plain text</strong> — best for feeding the conversation
              back into another AI tool, scripts, or automation.
            </li>
          </ul>

          <AdSlot slot="pillar-mid-2" format="leaderboard" />

          <h2>Per-platform deep-dives</h2>
          <p>
            Each AI platform has its own quirks — the location of the share
            button, the URL format, what happens with multi-turn vs.
            single-message shares. We have detailed guides for each:
          </p>
        </article>

        <ul className="grid gap-3 sm:grid-cols-2 mt-6">
          {SPOKES.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="block p-4 rounded-lg border border-border/60 bg-card/40 hover:border-primary/40 hover:bg-card/80 transition-colors h-full"
              >
                <p className="text-foreground font-medium mb-1">{s.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {s.description}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <article
          className="
            prose prose-invert max-w-none mt-12
            prose-headings:text-foreground prose-headings:tracking-tight
            prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
            prose-p:text-muted-foreground prose-p:leading-relaxed
            prose-li:text-muted-foreground
            prose-strong:text-foreground
            prose-a:text-primary hover:prose-a:underline
          "
        >
          <h2>Building a permanent AI chat archive</h2>
          <p>
            If you're saving conversations regularly — for research, legal
            retention, knowledge work, or just personal reference — invest
            ten minutes in a folder structure that scales:
          </p>
          <ul>
            <li>
              <strong>One folder per platform</strong>{" "}
              (<code>chatgpt/</code>, <code>claude/</code>,{" "}
              <code>gemini/</code>...) so you can filter by source.
            </li>
            <li>
              <strong>Date-prefix filenames</strong> like{" "}
              <code>2026-05-03-claude-pricing-model-debate.md</code> for
              chronological ordering.
            </li>
            <li>
              <strong>Front-matter metadata</strong> at the top of each
              Markdown file (the source URL, the model, the date) so future
              you can verify the source.
            </li>
            <li>
              <strong>Index in a notes app</strong> like Obsidian or Notion
              for search, tags, and backlinks.
            </li>
          </ul>

          <h2>What we don't store</h2>
          <p>
            <Link href="/">{SITE_NAME}</Link> processes every extraction in
            memory and discards it. We don't keep the share URL, the parsed
            conversation, or any user-identifying metadata. There is no
            account, no cookie, no analytics on the conversation content.
            See our <Link href="/privacy">privacy policy</Link> for the full
            details.
          </p>
        </article>

        {/* FAQ */}
        <section aria-labelledby="faq-heading" className="mt-14">
          <h2
            id="faq-heading"
            className="text-2xl font-bold text-foreground tracking-tight mb-2"
          >
            Frequently asked
          </h2>
          <dl className="divide-y divide-border/60 border-y border-border/60">
            {FAQS.map((f, i) => (
              <div key={i} className="py-5">
                <dt className="text-foreground font-semibold mb-2">{f.q}</dt>
                <dd className="text-muted-foreground leading-relaxed">
                  {f.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* CTA */}
        <aside className="mt-14 p-6 rounded-xl border border-primary/40 bg-primary/5 text-center">
          <p className="text-xl font-bold text-foreground mb-2">
            Save your first conversation now
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Free, instant, no signup. Works with all six major platforms.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            Try {SITE_NAME} <ArrowRight className="w-4 h-4" />
          </Link>
        </aside>
      </main>
    </Layout>
  );
}
