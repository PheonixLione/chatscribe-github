import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { ContentPage } from "@/components/ContentPage";
import { useSEO } from "@/lib/seo";

interface PlatformInfo {
  name: string;
  hosts: string[];
  example: string;
  howToShare: string;
}

const PLATFORMS: PlatformInfo[] = [
  {
    name: "ChatGPT",
    hosts: ["chatgpt.com/share/...", "chat.openai.com/share/..."],
    example: "https://chatgpt.com/share/abcd-1234",
    howToShare:
      "In ChatGPT, open the conversation, click the Share icon in the top-right, then \"Create link\". Copy the resulting link and paste it into ChatScribe.",
  },
  {
    name: "Claude",
    hosts: ["claude.ai/share/..."],
    example: "https://claude.ai/share/abcd-1234",
    howToShare:
      "In Claude, open the conversation, click the Share button in the top-right, choose \"Create public link\", then copy the link.",
  },
  {
    name: "Gemini",
    hosts: ["gemini.google.com/share/...", "g.co/gemini/share/..."],
    example: "https://gemini.google.com/share/abcd1234",
    howToShare:
      "In Gemini, click the Share & export icon under the prompt, choose \"Create public link\", then copy the generated URL.",
  },
  {
    name: "Grok",
    hosts: ["grok.com/share/...", "x.com/i/grok/share/..."],
    example: "https://grok.com/share/abcd1234",
    howToShare:
      "In Grok (on grok.com or X), open the conversation menu and select \"Share\" to generate a public link.",
  },
  {
    name: "Perplexity",
    hosts: ["perplexity.ai/search/..."],
    example: "https://www.perplexity.ai/search/your-question-abcd1234",
    howToShare:
      "Perplexity search threads are public by default. Just copy the URL of the thread you want to extract.",
  },
  {
    name: "DeepSeek",
    hosts: ["chat.deepseek.com/share/..."],
    example: "https://chat.deepseek.com/share/abcd1234",
    howToShare:
      "In DeepSeek, open the conversation, click Share, and copy the public link it generates.",
  },
];

export default function SupportedPlatforms() {
  useSEO({
    title: "Supported AI Platforms",
    description:
      "ChatScribe supports ChatGPT, Claude, Gemini, Grok, Perplexity, and DeepSeek public share links. See the URL formats we accept and how to share from each platform.",
    path: "/supported-platforms",
    keywords:
      "extract chatgpt share link, claude share link extractor, gemini chat exporter, grok share extractor, perplexity exporter, deepseek share",
  });

  return (
    <Layout>
      <ContentPage
        eyebrow="Reference"
        title="Supported AI platforms"
        intro="ChatScribe works with public share links from every major AI chat platform. If you can open a link in an incognito tab without signing in, we can extract it."
      >
        <p>
          Below is the full list of supported sources, their URL formats, and a
          short guide on how to generate a share link from each one.
        </p>

        {PLATFORMS.map((p) => (
          <section key={p.name}>
            <h2>{p.name}</h2>
            <p>
              <strong>Supported URL patterns:</strong>
            </p>
            <ul>
              {p.hosts.map((h) => (
                <li key={h}><code>{h}</code></li>
              ))}
            </ul>
            <p>
              <strong>Example:</strong> <code>{p.example}</code>
            </p>
            <p>
              <strong>How to share from {p.name}:</strong> {p.howToShare}
            </p>
          </section>
        ))}

        <h2>Don't see your platform?</h2>
        <p>
          We add new sources as they ship public share features. If you'd like
          to suggest one, please reach out — see the
          <Link href="/about"> About page</Link>. In the meantime, you can read
          <Link href="/how-it-works"> how the extractor works</Link> or
          <Link href="/"> try it now</Link>.
        </p>
      </ContentPage>
    </Layout>
  );
}
