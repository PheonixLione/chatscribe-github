import { GuideLayout } from "@/components/GuideLayout";

export default function ExportClaudeToMarkdown() {
  return (
    <GuideLayout
      path="/guides/export-claude-to-markdown"
      title="How to export a Claude conversation to Markdown"
      description="Turn any Claude.ai share link into clean Markdown with code blocks, lists, and inline formatting preserved — ready for Notion, Obsidian, or GitHub."
      keywords="export claude to markdown, claude conversation to markdown, claude share link, save claude chat, claude.ai download, anthropic chat export"
      eyebrow="CLAUDE GUIDE"
      heading="How to export a Claude conversation to Markdown"
      tldr="To export a Claude conversation to Markdown: open the chat in Claude.ai, click the Share button at the top, copy the public link (claude.ai/share/...), paste it into Chat Extractor, and click Download as Markdown. Code blocks, lists, headings, and inline formatting are preserved exactly."
      pillar={{
        href: "/guides/save-ai-conversations",
        title: "The complete guide to saving AI conversations",
      }}
      howTo={{
        name: "Export a Claude conversation to Markdown",
        description:
          "Save any Claude.ai conversation as a clean Markdown file using the share link.",
        totalTime: "PT1M",
        steps: [
          {
            name: "Open the Claude conversation",
            text: "Sign in to claude.ai and open the conversation you want to export.",
          },
          {
            name: "Click the Share button",
            text: "Click the share icon in the top-right of the conversation. Claude will create a public, read-only link.",
          },
          {
            name: "Copy the share URL",
            text: "Copy the generated URL — it will look like https://claude.ai/share/...",
          },
          {
            name: "Paste into Chat Extractor",
            text: "Open chatextractor.replit.app, paste the URL, and click Extract. The conversation will render in seconds.",
          },
          {
            name: "Download as Markdown",
            text: "Click the Markdown download button. You'll get a .md file with headings, fenced code blocks (with language tags), bullet/numbered lists, bold/italic, and links all preserved.",
          },
        ],
      }}
      faqs={[
        {
          q: "Why Markdown specifically for Claude?",
          a: "Claude's responses are particularly Markdown-friendly — Anthropic has trained the model to use headings, code fences, and structured lists by default. Exporting to Markdown gives you a near-perfect reproduction of what you saw in the chat.",
        },
        {
          q: "Will it work with Claude Projects or Artifacts?",
          a: "It works with any conversation Claude lets you create a public share link from. Artifacts (the side panel containing generated code or documents) are included inline with the rest of the message they belong to.",
        },
        {
          q: "Can I import the Markdown into Notion or Obsidian?",
          a: "Yes — that's exactly what the format is designed for. In Notion, paste the file contents into a new page. In Obsidian, drop the .md file into your vault. Code blocks render correctly, headings build the outline, and links remain clickable.",
        },
        {
          q: "Does it preserve the model name and date?",
          a: "The conversation content is preserved verbatim. We don't currently inject metadata at the top — but you can add your own front-matter (--- model: claude-opus-4 --- date: 2026-05-03 ---) when you save the file.",
        },
        {
          q: "What about conversations with attachments I uploaded?",
          a: "The text and Claude's responses are extracted normally. Attached files (images, PDFs) you uploaded into the chat are not pulled out — only the visible conversation transcript.",
        },
      ]}
      related={[
        {
          href: "/guides/save-chatgpt-as-pdf",
          title: "Save a ChatGPT conversation as PDF",
          description: "The ChatGPT equivalent for PDF export.",
        },
        {
          href: "/guides/convert-ai-chat-to-markdown",
          title: "Convert any AI chat to Markdown",
          description:
            "Cover ChatGPT, Gemini, Grok, Perplexity, and DeepSeek with one playbook.",
        },
        {
          href: "/guides/download-gemini-chat",
          title: "Download a Gemini chat",
          description: "Save a Google Gemini conversation in any format.",
        },
        {
          href: "/guides/save-ai-conversations",
          title: "The complete guide to saving AI conversations",
          description: "Pillar overview of every option, across every platform.",
        },
      ]}
    />
  );
}
