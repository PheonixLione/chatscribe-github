import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { ContentPage } from "@/components/ContentPage";
import { useSEO } from "@/lib/seo";

export default function About() {
  useSEO({
    title: "About ChatScribe",
    description:
      "ChatScribe is a free, privacy-respecting tool for saving public AI chat conversations from ChatGPT, Claude, Gemini, Grok, Perplexity, and DeepSeek.",
    path: "/about",
    keywords:
      "about chat extractor, ai conversation saver, free ai chat tool, privacy-focused ai exporter",
  });

  return (
    <Layout>
      <ContentPage
        eyebrow="About"
        title="About ChatScribe"
        intro="A simple, free tool for keeping the AI conversations that matter."
      >
        <h2>Why we built this</h2>
        <p>
          Some of the best work happening today happens inside AI chat
          interfaces — debugging sessions, research threads, planning
          documents, drafts, and one-off explanations that turn out to be
          surprisingly useful months later.
        </p>
        <p>
          Every major AI platform offers a "share" feature, but a shared link
          is a fragile artifact. It lives on someone else's server, behind
          someone else's UI, subject to someone else's product changes. If you
          want a copy you actually own, you have to hand-scrape it.
        </p>
        <p>
          ChatScribe exists to make that one-click. Paste a public share
          link, get a clean Markdown / PDF / text copy you can keep, share,
          search, or paste into your own notes.
        </p>

        <h2>What it does</h2>
        <ul>
          <li>Extracts the full conversation from a public share link.</li>
          <li>
            Preserves formatting — code blocks, lists, tables, inline
            emphasis.
          </li>
          <li>Handles long conversations by waiting for the transcript to fully render.</li>
          <li>Exports as Markdown, plain text, or PDF.</li>
          <li>Works with the major platforms — see <Link href="/supported-platforms">supported platforms</Link>.</li>
        </ul>

        <h2>Privacy</h2>
        <p>
          We don't require accounts and we don't store your data. The link you
          paste and the conversation we return are both processed in memory and
          discarded as soon as the response is sent. Read the full
          <Link href="/privacy"> privacy policy</Link> for details.
        </p>

        <h2>Independence</h2>
        <p>
          ChatScribe is an independent project. It is not affiliated with,
          endorsed by, or sponsored by OpenAI, Anthropic, Google, xAI,
          Perplexity, DeepSeek, or any other AI platform. All trademarks belong
          to their respective owners. We only access content that the platform
          itself has chosen to make public via a share link.
        </p>

        <h2>Get started</h2>
        <p>
          Ready to try it? Head back to the <Link href="/">home page</Link> and
          paste a share link. If you hit any snag, the <Link href="/faq">FAQ</Link>
          covers the common cases.
        </p>
      </ContentPage>
    </Layout>
  );
}
