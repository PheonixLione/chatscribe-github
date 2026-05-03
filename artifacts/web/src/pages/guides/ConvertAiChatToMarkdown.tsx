import { GuideLayout } from "@/components/GuideLayout";

export default function ConvertAiChatToMarkdown() {
  return (
    <GuideLayout
      path="/guides/convert-ai-chat-to-markdown"
      title="How to convert any AI chat to Markdown"
      description="A platform-agnostic playbook for turning ChatGPT, Claude, Gemini, Grok, Perplexity, or DeepSeek conversations into clean Markdown — usable in Notion, Obsidian, GitHub, or any editor."
      keywords="convert ai chat to markdown, ai conversation to markdown, chatgpt to markdown, claude to markdown, gemini to markdown, grok to markdown, perplexity to markdown, deepseek to markdown"
      eyebrow="UNIVERSAL GUIDE"
      heading="How to convert any AI chat to Markdown"
      tldr="Every major AI platform (ChatGPT, Claude, Gemini, Grok, Perplexity, DeepSeek) lets you generate a public share link for a conversation. Paste that link into ChatScribe and click Download as Markdown — the result is plain text that opens in any editor and preserves all formatting."
      pillar={{
        href: "/guides/save-ai-conversations",
        title: "The complete guide to saving AI conversations",
      }}
      howTo={{
        name: "Convert an AI conversation to Markdown",
        description:
          "Universal three-step process for turning any AI chat share link into clean Markdown.",
        totalTime: "PT1M",
        steps: [
          {
            name: "Generate a public share link inside the AI tool",
            text: "Every major platform has a Share button. ChatGPT: top-right of the conversation. Claude: top-right. Gemini: Share & export menu under any response. Grok: Share button in the conversation header. Perplexity: Share icon next to the threads. DeepSeek: Share button in the chat menu.",
          },
          {
            name: "Copy the share URL",
            text: "Copy the generated public URL. The exact format differs per platform but they all look like /share/... or contain the word 'share' somewhere in the path.",
          },
          {
            name: "Paste into ChatScribe and download Markdown",
            text: "Open chatextractor.replit.app, paste the URL, click Extract, then click the Markdown download button. The .md file preserves headings, fenced code blocks (with language tags), bullet/numbered lists, bold/italic, links, and tables.",
          },
        ],
      }}
      faqs={[
        {
          q: "Why Markdown over PDF?",
          a: "Markdown is plain text. It opens in any editor on any device for the next several decades. It's smaller. It's searchable. It paste-works in Notion, Obsidian, GitHub, GitLab, Discord, Slack, Reddit, and most note-taking and dev tools. PDF is better when you need a fixed visual layout — Markdown is better for everything else.",
        },
        {
          q: "Will the formatting really survive?",
          a: "Yes. We preserve: # headings (H1–H6), - bullet lists, 1. numbered lists, ``` fenced code blocks with language tags, `inline code`, **bold**, *italic*, [links](url), tables, blockquotes, and horizontal rules. Math is preserved as raw LaTeX (which most Markdown renderers handle).",
        },
        {
          q: "Can I script this for multiple conversations?",
          a: "The web extractor is interactive, but the underlying logic is straightforward — fetch the public share URL, parse the conversation structure, emit Markdown. If you need a CLI or API, get in touch via the About page.",
        },
        {
          q: "What if my Markdown editor doesn't render code blocks correctly?",
          a: "Most likely the editor doesn't support fenced code blocks (the ``` syntax). Try opening the file in VS Code, GitHub's preview, Notion, or Obsidian — all of which support standard CommonMark with code-block extensions.",
        },
        {
          q: "Are the file names predictable?",
          a: "Yes. Files are named based on the conversation title (or the first user message if no title is available), with a timestamp suffix. You can rename them freely after download — none of the metadata is embedded in the filename itself.",
        },
      ]}
      related={[
        {
          href: "/guides/save-chatgpt-as-pdf",
          title: "Save a ChatGPT conversation as PDF",
          description: "Per-platform deep dive for ChatGPT.",
        },
        {
          href: "/guides/export-claude-to-markdown",
          title: "Export a Claude conversation to Markdown",
          description: "Per-platform deep dive for Claude.ai.",
        },
        {
          href: "/guides/download-gemini-chat",
          title: "Download a Gemini chat",
          description: "Per-platform deep dive for Google Gemini.",
        },
        {
          href: "/guides/save-grok-conversation",
          title: "Save a Grok (xAI) conversation",
          description: "Per-platform deep dive for Grok.",
        },
      ]}
    />
  );
}
