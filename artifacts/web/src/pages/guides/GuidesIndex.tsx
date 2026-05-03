import { Link } from "wouter";
import { ArrowRight, BookOpen } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useSEO, useJsonLd, breadcrumbLd } from "@/lib/seo";

const PILLAR = {
  href: "/guides/save-ai-conversations",
  title: "The complete guide to saving AI conversations",
  description:
    "Why AI chats disappear, what your options are, and how to keep a permanent searchable copy of every important conversation — across ChatGPT, Claude, Gemini, Grok, Perplexity, and DeepSeek.",
};

const SPOKES = [
  {
    href: "/guides/save-chatgpt-as-pdf",
    title: "How to save a ChatGPT conversation as PDF",
    description:
      "Three ways to export a ChatGPT chat to PDF: built-in print, the share-link method, and Chat Extractor for clean formatting.",
  },
  {
    href: "/guides/export-claude-to-markdown",
    title: "How to export a Claude conversation to Markdown",
    description:
      "Turn any Claude.ai share link into clean Markdown with code blocks and formatting preserved — ready to paste into Notion, Obsidian, or GitHub.",
  },
  {
    href: "/guides/download-gemini-chat",
    title: "How to download a Gemini chat (Google AI)",
    description:
      "Step-by-step: share a Gemini conversation, then save it as Markdown, PDF, or text without screenshots or copy-paste.",
  },
  {
    href: "/guides/save-grok-conversation",
    title: "How to save a Grok (xAI) conversation",
    description:
      "Grok shares are public but ephemeral. Here's how to archive them safely as Markdown or PDF in under a minute.",
  },
  {
    href: "/guides/convert-ai-chat-to-markdown",
    title: "How to convert any AI chat to Markdown",
    description:
      "A platform-agnostic playbook for turning ChatGPT, Claude, Gemini, Grok, Perplexity, or DeepSeek conversations into clean Markdown.",
  },
];

export default function GuidesIndex() {
  useSEO({
    title: "Guides — How to save and export AI conversations",
    description:
      "Step-by-step guides for saving, exporting, and archiving AI chat conversations from ChatGPT, Claude, Gemini, Grok, Perplexity, and DeepSeek.",
    path: "/guides",
    keywords:
      "ai chat guides, save chatgpt, export claude, download gemini chat, save grok, ai conversation to markdown, ai chat to pdf",
  });

  useJsonLd(
    "breadcrumb-guides",
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Guides", path: "/guides" },
    ]),
  );

  useJsonLd("guides-itemlist", {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Chat Extractor guides",
    itemListElement: [PILLAR, ...SPOKES].map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://chatextractor.replit.app${g.href}`,
      name: g.title,
    })),
  });

  return (
    <Layout>
      <main className="max-w-4xl mx-auto px-4 py-12 sm:py-20">
        <header className="mb-12 space-y-3 text-center">
          <p className="text-xs font-mono uppercase tracking-wider text-primary">
            LIBRARY
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Guides for saving AI conversations
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Practical, step-by-step playbooks for keeping a permanent copy of
            every important AI chat — across every major platform.
          </p>
        </header>

        {/* Pillar */}
        <Link
          href={PILLAR.href}
          className="block mb-10 p-6 sm:p-8 rounded-2xl border border-primary/40 bg-primary/5 hover:border-primary/70 hover:bg-primary/10 transition-colors group"
        >
          <p className="text-xs font-mono uppercase tracking-wider text-primary mb-3 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5" />
            Start here · Pillar guide
          </p>
          <h2 className="text-2xl font-bold text-foreground tracking-tight mb-2 group-hover:text-primary transition-colors">
            {PILLAR.title}
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            {PILLAR.description}
          </p>
          <span className="inline-flex items-center gap-1 text-sm text-primary font-medium">
            Read the pillar guide{" "}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>

        {/* Spokes */}
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4">
          Platform & format guides
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {SPOKES.map((g) => (
            <li key={g.href}>
              <Link
                href={g.href}
                className="block p-5 rounded-xl border border-border/60 bg-card/40 hover:border-primary/40 hover:bg-card/80 transition-colors h-full"
              >
                <h3 className="text-foreground font-semibold mb-2">{g.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {g.description}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </Layout>
  );
}
