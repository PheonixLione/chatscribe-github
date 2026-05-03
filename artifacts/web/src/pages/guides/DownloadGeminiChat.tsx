import { GuideLayout } from "@/components/GuideLayout";

export default function DownloadGeminiChat() {
  return (
    <GuideLayout
      path="/guides/download-gemini-chat"
      title="How to download a Gemini chat (Google AI)"
      description="Step-by-step: share a Gemini conversation, then save the public link as Markdown, PDF, or plain text. No screenshots, no copy-paste."
      keywords="download gemini chat, save gemini conversation, gemini share link, google gemini export, gemini to markdown, gemini to pdf"
      eyebrow="GEMINI GUIDE"
      heading="How to download a Gemini (Google AI) chat"
      tldr="To download a Gemini conversation: open it on gemini.google.com, click the Share & export menu, choose Share, copy the public g.co/gemini/share/... link, paste it into Chat Extractor, and click your preferred download format (Markdown, PDF, or plain text)."
      pillar={{
        href: "/guides/save-ai-conversations",
        title: "The complete guide to saving AI conversations",
      }}
      howTo={{
        name: "Download a Gemini conversation",
        description:
          "Export any Google Gemini conversation as Markdown, PDF, or plain text using the public share link.",
        totalTime: "PT1M",
        steps: [
          {
            name: "Open the Gemini conversation",
            text: "Go to gemini.google.com and open the chat you want to save.",
          },
          {
            name: "Open the Share & export menu",
            text: "At the bottom of any Gemini response, click the Share & export icon (it looks like an arrow pointing up out of a box).",
          },
          {
            name: "Choose 'Share'",
            text: "Pick the Share option, then 'Create public link'. Gemini will generate a g.co/gemini/share/... URL anyone can open.",
          },
          {
            name: "Copy the link and paste into Chat Extractor",
            text: "Copy the public URL, open chatextractor.replit.app, paste it into the input, and click Extract.",
          },
          {
            name: "Download in your preferred format",
            text: "Choose Markdown for archives, PDF for sharing or printing, or plain text for piping into other tools.",
          },
        ],
      }}
      faqs={[
        {
          q: "Why doesn't Gemini have a built-in download?",
          a: "Gemini's official Share & export menu only offers 'Share' (creates a public link) and 'Export to Docs' (sends the response to Google Docs). There's no native Markdown or PDF download — that's the gap Chat Extractor fills.",
        },
        {
          q: "Does this work with Gemini Advanced (the paid tier)?",
          a: "Yes. The share-link mechanism is the same on free Gemini and Gemini Advanced. The model that generated the responses doesn't change anything about the export process.",
        },
        {
          q: "What if 'Share' is greyed out?",
          a: "Some workspace and education accounts have sharing disabled by admin policy. In that case the only options are Export to Docs (then download from there) or copy-paste, neither of which preserves formatting cleanly. Try with a personal Google account instead.",
        },
        {
          q: "Will it capture multi-turn conversations?",
          a: "Gemini's share button shares the entire conversation thread up to the point you clicked it, not just one response. Chat Extractor preserves the full back-and-forth.",
        },
        {
          q: "Are images Gemini generated included?",
          a: "Inline images are referenced in the export. For best image quality, right-click and save them from the original Gemini page in addition to the text export.",
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
          description: "The Claude.ai version of this workflow.",
        },
        {
          href: "/guides/save-grok-conversation",
          title: "Save a Grok (xAI) conversation",
          description: "Archive ephemeral Grok shares before they expire.",
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
