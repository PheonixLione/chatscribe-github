import { GuideLayout } from "@/components/GuideLayout";

export default function SaveGrokConversation() {
  return (
    <GuideLayout
      path="/guides/save-grok-conversation"
      title="How to save a Grok (xAI) conversation"
      description="Grok shares are public but ephemeral. Here's how to archive them safely as Markdown or PDF before the link rotates or the share is revoked."
      keywords="save grok conversation, grok share link, xai grok export, grok to markdown, grok to pdf, x ai chat archive"
      eyebrow="GROK GUIDE"
      heading="How to save a Grok (xAI) conversation"
      tldr="To save a Grok chat: open the conversation on grok.com or x.com, click the Share button, copy the public link (grok.com/share/... or x.com/i/grok/share/...), paste it into ChatScribe, and download as Markdown or PDF. Do this soon — Grok shares can be revoked or rotated by xAI."
      pillar={{
        href: "/guides/save-ai-conversations",
        title: "The complete guide to saving AI conversations",
      }}
      howTo={{
        name: "Save a Grok conversation",
        description:
          "Archive a Grok (xAI) conversation as Markdown or PDF using its public share link.",
        totalTime: "PT1M",
        steps: [
          {
            name: "Open the Grok conversation",
            text: "Go to grok.com (or open Grok inside x.com) and find the conversation you want to keep.",
          },
          {
            name: "Click Share",
            text: "Use the Share button in the conversation interface. Grok will generate a public, read-only link.",
          },
          {
            name: "Copy the link",
            text: "Copy the URL. It will look like https://grok.com/share/... or https://x.com/i/grok/share/... depending on where you opened the share dialog.",
          },
          {
            name: "Extract with ChatScribe",
            text: "Paste the link into chatextractor.replit.app and click Extract. We use a headless browser to capture the rendered conversation, since Grok pages hydrate content with JavaScript.",
          },
          {
            name: "Download as Markdown or PDF",
            text: "Markdown is best if you want to keep the conversation in a notes app or version control. PDF is best for sharing or printing.",
          },
        ],
      }}
      faqs={[
        {
          q: "Why are Grok shares 'ephemeral'?",
          a: "xAI has rotated share-link formats more aggressively than other providers, and shared conversations have been retroactively removed during model migrations. If a Grok conversation matters to you, archive it the same day you create it.",
        },
        {
          q: "Does this support both grok.com and x.com share URLs?",
          a: "Yes. Both URL patterns route to the same conversation data and are handled by the same extractor. You don't need to convert one to the other.",
        },
        {
          q: "Why does extraction take a few seconds longer than ChatGPT or Claude?",
          a: "Grok's share pages render the conversation client-side with JavaScript instead of serving the full content in the initial HTML. We run a short headless-browser pass to wait for the messages to hydrate, which adds a couple of seconds.",
        },
        {
          q: "Can I extract Grok chats that are not shared publicly?",
          a: "No. Like every other platform, ChatScribe only works with public share URLs. Generate a share link first, then extract immediately.",
        },
        {
          q: "Will code blocks and tables be preserved?",
          a: "Yes. We extract the rendered conversation structure including code blocks (with language tags), tables, headings, and lists. The Markdown and PDF outputs both preserve this formatting.",
        },
      ]}
      related={[
        {
          href: "/guides/save-chatgpt-as-pdf",
          title: "Save a ChatGPT conversation as PDF",
          description: "The ChatGPT version of this workflow.",
        },
        {
          href: "/guides/export-claude-to-markdown",
          title: "Export a Claude conversation to Markdown",
          description: "Same workflow, Claude.ai instead.",
        },
        {
          href: "/guides/download-gemini-chat",
          title: "Download a Gemini chat",
          description: "The Google Gemini version of this workflow.",
        },
        {
          href: "/guides/save-ai-conversations",
          title: "The complete guide to saving AI conversations",
          description: "Pillar overview across every platform.",
        },
      ]}
    />
  );
}
