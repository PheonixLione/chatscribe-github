import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { ContentPage } from "@/components/ContentPage";
import { useSEO } from "@/lib/seo";

export default function HowItWorks() {
  useSEO({
    title: "How It Works",
    description:
      "Learn how ChatScribe turns a public ChatGPT, Claude, Gemini, Grok, or DeepSeek share link into clean Markdown, PDF, or text in seconds.",
    path: "/how-it-works",
    keywords:
      "how to extract chatgpt conversation, save claude chat, export gemini chat, download grok conversation",
  });

  return (
    <Layout>
      <ContentPage
        eyebrow="Guide"
        title="How ChatScribe works"
        intro="Three steps from a public share link to a clean copy you actually own. No accounts, no plugins, no copy-pasting screenshots."
      >
        <h2>1. Paste a public share link</h2>
        <p>
          Open the AI chat you want to save and use the platform's built-in
          <strong> Share </strong> action to generate a public link. We support
          ChatGPT, Claude, Gemini, Grok, and DeepSeek shares —
          <Link href="/supported-platforms"> see the full list</Link>.
        </p>
        <p>
          Paste the link into the box on the <Link href="/">home page</Link> and
          click <strong>Extract</strong>. That's it.
        </p>

        <h2>2. We fetch and parse the conversation</h2>
        <p>
          Behind the scenes we request the same public page your browser would,
          locate the conversation in the page payload (or render it in a
          headless browser when the platform hydrates messages with JavaScript),
          and convert each turn into structured Markdown. Code blocks, lists,
          tables, and inline formatting are preserved.
        </p>
        <p>
          Long conversations work too — the extractor streams pages and waits
          for the transcript to fully render before parsing, so multi-thousand
          message threads come through intact.
        </p>

        <h2>3. Read, copy, or export</h2>
        <p>
          You'll see the full conversation rendered in a clean reading view.
          From there you can:
        </p>
        <ul>
          <li><strong>Copy</strong> the entire conversation as Markdown to your clipboard.</li>
          <li><strong>Download</strong> a <code>.md</code> file for note apps like Obsidian or Notion.</li>
          <li><strong>Download</strong> a <code>.txt</code> file for plain-text archives.</li>
          <li><strong>Download</strong> a <code>.pdf</code> for sharing or printing.</li>
        </ul>

        <h2>What does it cost?</h2>
        <p>
          Nothing. ChatScribe is free to use and doesn't require an account.
          We don't store your links or your extracted conversations — every
          request is processed and discarded.
        </p>

        <h2>Frequently asked</h2>
        <p>
          Have a question we didn't answer here? Check the
          <Link href="/faq"> FAQ</Link> or read more
          <Link href="/about"> about the project</Link>.
        </p>
      </ContentPage>
    </Layout>
  );
}
