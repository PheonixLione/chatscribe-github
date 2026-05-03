import { GuideLayout } from "@/components/GuideLayout";

export default function SaveChatgptAsPdf() {
  return (
    <GuideLayout
      path="/guides/save-chatgpt-as-pdf"
      title="How to save a ChatGPT conversation as PDF"
      description="Three ways to export a ChatGPT chat to PDF — built-in print, the share-link method, and a one-click extractor that preserves all formatting."
      keywords="save chatgpt as pdf, export chatgpt to pdf, chatgpt to pdf, download chatgpt conversation pdf, chatgpt share link to pdf"
      eyebrow="CHATGPT GUIDE"
      heading="How to save a ChatGPT conversation as PDF"
      tldr="The cleanest way to save a ChatGPT chat as PDF: open the conversation, click the Share button, copy the public link, paste it into Chat Extractor, and click Download as PDF. This preserves code blocks, lists, and inline formatting — which browser print-to-PDF usually mangles."
      pillar={{
        href: "/guides/save-ai-conversations",
        title: "The complete guide to saving AI conversations",
      }}
      howTo={{
        name: "Save a ChatGPT conversation as PDF",
        description:
          "Export any ChatGPT conversation to a clean PDF using the share link.",
        totalTime: "PT1M",
        steps: [
          {
            name: "Open the ChatGPT conversation",
            text: "Sign in to chat.openai.com and open the conversation you want to save.",
          },
          {
            name: "Click the Share button",
            text: "In the conversation header, click the share icon (an arrow pointing up out of a box). ChatGPT will offer to create a public link.",
          },
          {
            name: "Create and copy the public link",
            text: "Click 'Create link' (or 'Update link' if one exists), then copy the URL. It will look like https://chatgpt.com/share/...",
          },
          {
            name: "Paste the link into Chat Extractor",
            text: "Open chatextractor.replit.app, paste the URL into the input box, and click Extract.",
          },
          {
            name: "Download as PDF",
            text: "Once the conversation renders, click the PDF download button. The file will preserve headings, bullet lists, and code blocks exactly as they appeared in ChatGPT.",
          },
        ],
      }}
      faqs={[
        {
          q: "Why not just use the browser's print-to-PDF?",
          a: "You can, but the result is usually messy. ChatGPT's interface isn't optimized for print stylesheets — sidebars get included, code blocks overflow the page width, message avatars repeat, and long conversations break across pages mid-thought. The share-link method produces a document built specifically to look right in PDF.",
        },
        {
          q: "Does the PDF include code blocks correctly?",
          a: "Yes. Code blocks are preserved with monospace formatting and a subtle background, language tags are kept, and long lines wrap properly instead of overflowing off the page.",
        },
        {
          q: "Can I save a private ChatGPT conversation without sharing it publicly?",
          a: "Not directly through Chat Extractor — we only work with public share URLs. The workaround is to create the share link, save the PDF, and then immediately delete the share link from your ChatGPT account. The link only needs to exist for the few seconds it takes us to fetch the page.",
        },
        {
          q: "Will images and DALL·E generations be included?",
          a: "Inline images embedded in the conversation are referenced in the PDF. For full-quality image archival, save the images separately from the source conversation.",
        },
        {
          q: "Is there a length limit?",
          a: "No fixed limit, but very long conversations (thousands of messages) take longer to fetch and render. For practical purposes, every normal-length ChatGPT conversation works.",
        },
      ]}
      related={[
        {
          href: "/guides/export-claude-to-markdown",
          title: "Export a Claude conversation to Markdown",
          description:
            "The Claude.ai equivalent — turn a share link into clean Markdown.",
        },
        {
          href: "/guides/download-gemini-chat",
          title: "Download a Gemini chat",
          description: "Save a Google Gemini conversation as PDF or Markdown.",
        },
        {
          href: "/guides/convert-ai-chat-to-markdown",
          title: "Convert any AI chat to Markdown",
          description:
            "A platform-agnostic playbook covering all six major AI providers.",
        },
        {
          href: "/guides/save-ai-conversations",
          title: "The complete guide to saving AI conversations",
          description:
            "Why AI chats disappear and how to build a permanent archive.",
        },
      ]}
    />
  );
}
