import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  useExtractConversation,
  useListSupportedSources,
  useHealthCheck,
  Conversation,
  ExtractError,
  ApiError,
} from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Download,
  FileText,
  File,
  ExternalLink,
  ChevronLeft,
  Sparkles,
  Loader2,
  XCircle,
  ShieldCheck,
  Zap,
  FileDown,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layout } from "@/components/Layout";
import { AdSlot } from "@/components/AdSlot";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import {
  copyToClipboard,
  downloadBlob,
  downloadPdf,
  generateMarkdownText,
  generatePlainText,
} from "@/lib/exportUtils";
import { useToast } from "@/hooks/use-toast";
import { SITE_NAME, SITE_URL, useSEO } from "@/lib/seo";

function StatusIndicator() {
  const { data: health, isSuccess } = useHealthCheck();
  return (
    <div
      className={`fixed bottom-4 right-4 w-2 h-2 rounded-full ${isSuccess ? "bg-emerald-500" : "bg-muted"} transition-colors duration-1000`}
      title={isSuccess ? "API Connected" : "Connecting..."}
    />
  );
}

const FEATURES = [
  {
    icon: Zap,
    title: "Instant extraction",
    body: "Paste a public ChatGPT, Claude, Gemini, Grok, Perplexity, or DeepSeek share link and get the full conversation in seconds.",
  },
  {
    icon: FileDown,
    title: "Markdown, PDF & text",
    body: "One-click copy as Markdown or download as .md, .txt, or .pdf — perfect for Notion, Obsidian, or your personal archive.",
  },
  {
    icon: ShieldCheck,
    title: "No signup, no storage",
    body: "Free to use, no account required. We don't keep your links or your conversations on our servers.",
  },
  {
    icon: Lock,
    title: "Public links only",
    body: "Chat Extractor only reads links the AI platform has chosen to make public. Your private chats stay private.",
  },
];

const PLATFORMS_PREVIEW = [
  "ChatGPT",
  "Claude",
  "Gemini",
  "Grok",
  "Perplexity",
  "DeepSeek",
];

export function Home() {
  const [url, setUrl] = useState("");
  const [conversation, setConversation] = useState<Conversation | null>(null);

  const extractMutation = useExtractConversation();
  const { data: sourcesData } = useListSupportedSources();
  const { toast } = useToast();

  useSEO({
    title: SITE_NAME,
    description:
      "Free tool to extract any public AI chat share link (ChatGPT, Claude, Gemini, Grok, Perplexity, DeepSeek) as clean Markdown, PDF, or plain text. No signup, no storage.",
    path: "/",
    keywords:
      "chatgpt extractor, save chatgpt conversation, claude share link, gemini chat exporter, grok share, perplexity exporter, deepseek share, ai chat to markdown, ai chat to pdf",
  });

  // Inject WebSite + SearchAction structured data so Google can show
  // sitelinks and a search box in search results.
  useEffect(() => {
    const ld = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/?url={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "home-jsonld";
    script.text = JSON.stringify(ld);
    document.head.appendChild(script);
    return () => {
      document.getElementById("home-jsonld")?.remove();
    };
  }, []);

  const handleExtract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    extractMutation.mutate(
      { data: { url } },
      { onSuccess: (data) => setConversation(data) },
    );
  };

  function getErrorMessage(err: unknown): string {
    if (err instanceof ApiError) {
      const data = err.data as ExtractError | null;
      if (data?.message) return data.message;
      return err.message;
    }
    if (err instanceof Error) return err.message;
    return "An unexpected error occurred.";
  }

  const reset = () => {
    setConversation(null);
    setUrl("");
    extractMutation.reset();
  };

  const handleCopy = async () => {
    if (!conversation) return;
    const md = generateMarkdownText(conversation);
    try {
      await copyToClipboard(md);
      toast({ title: "Copied to clipboard", description: "Markdown text copied successfully." });
    } catch (err) {
      toast({ title: "Copy failed", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const handleDownloadMd = () => {
    if (!conversation) return;
    const md = generateMarkdownText(conversation);
    const blob = new Blob([md], { type: "text/markdown" });
    downloadBlob(blob, `chat-extract-${Date.now()}.md`);
  };

  const handleDownloadTxt = () => {
    if (!conversation) return;
    const txt = generatePlainText(conversation);
    const blob = new Blob([txt], { type: "text/plain" });
    downloadBlob(blob, `chat-extract-${Date.now()}.txt`);
  };

  const handleDownloadPdf = async () => {
    if (!conversation) return;
    toast({ title: "Generating PDF...", description: "This might take a moment." });
    try {
      await downloadPdf("conversation-content", `chat-extract-${Date.now()}.pdf`);
      toast({ title: "PDF Downloaded" });
    } catch (err) {
      toast({ title: "PDF failed", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <Layout>
      <StatusIndicator />

      <main className="max-w-4xl mx-auto px-4 py-12 sm:py-20">
        <AnimatePresence mode="wait">
          {!conversation && !extractMutation.isPending && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.3 }}
              className="space-y-16"
            >
              <section className="max-w-2xl mx-auto space-y-10">
                <div className="space-y-4 text-center">
                  <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                    Extract any AI chat share link
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    Paste a public ChatGPT, Claude, Gemini, Grok, Perplexity, or
                    DeepSeek link. Get a clean Markdown, PDF, or text copy in
                    seconds. Free, no signup.
                  </p>
                </div>

                <form onSubmit={handleExtract} className="relative group" aria-label="Extract a public AI chat share link">
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-primary opacity-20 group-hover:opacity-40 blur transition duration-500 rounded-lg"></div>
                  <div className="relative flex items-center bg-card border border-border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
                    <div className="pl-4 text-muted-foreground">
                      <ExternalLink className="w-5 h-5" />
                    </div>
                    <label htmlFor="share-url" className="sr-only">
                      Public share URL
                    </label>
                    <Input
                      id="share-url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://chatgpt.com/share/..."
                      className="flex-1 border-0 bg-transparent focus-visible:ring-0 text-lg py-6 placeholder:text-muted-foreground/50 h-auto"
                      autoFocus
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <Button
                      type="submit"
                      disabled={!url}
                      className="mr-2 px-8 py-5 h-auto text-base font-semibold"
                    >
                      Extract
                    </Button>
                  </div>
                </form>

                {extractMutation.isError && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-destructive/10 border border-destructive/20 text-destructive px-6 py-4 rounded-lg flex items-start gap-3"
                    role="alert"
                  >
                    <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-sm">Extraction failed</h3>
                      <p className="text-sm opacity-90 mt-1">
                        {getErrorMessage(extractMutation.error)}
                      </p>
                    </div>
                  </motion.div>
                )}

                <div className="pt-2">
                  <p className="text-xs font-mono text-muted-foreground mb-4 uppercase tracking-wider text-center">
                    Supported Platforms
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {(sourcesData?.sources?.map((s) => s.label) ?? PLATFORMS_PREVIEW).map(
                      (label) => (
                        <div
                          key={label}
                          className="px-3 py-1.5 rounded-md bg-secondary/50 border border-border/50 text-sm font-medium text-muted-foreground"
                        >
                          {label}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </section>

              <AdSlot slot="home-top" format="leaderboard" />

              {/* SEO content: features grid */}
              <section aria-labelledby="features-heading" className="border-t border-border/60 pt-16">
                <div className="text-center max-w-2xl mx-auto mb-10">
                  <h2 id="features-heading" className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Why use Chat Extractor?
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    A purpose-built tool for saving the AI conversations that matter.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {FEATURES.map(({ icon: Icon, title, body }) => (
                    <div
                      key={title}
                      className="bg-card/60 border border-border/60 rounded-xl p-5 space-y-2"
                    >
                      <div className="flex items-center gap-2 text-primary">
                        <Icon className="w-4 h-4" />
                        <h3 className="font-semibold text-white text-sm">{title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {body}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* SEO content: how it works */}
              <section aria-labelledby="how-heading" className="border-t border-border/60 pt-16">
                <div className="text-center max-w-2xl mx-auto mb-10">
                  <h2 id="how-heading" className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    How it works
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    Three steps from share link to a copy you own.
                  </p>
                </div>
                <ol className="grid gap-4 sm:grid-cols-3 text-sm">
                  {[
                    {
                      n: "01",
                      h: "Paste a public link",
                      p: "Use the platform's built-in Share action to generate a public URL, then paste it above.",
                    },
                    {
                      n: "02",
                      h: "We parse the conversation",
                      p: "Our extractor fetches the page, waits for it to fully render, and converts each turn to Markdown.",
                    },
                    {
                      n: "03",
                      h: "Read, copy, or export",
                      p: "Read it in our clean reader, copy as Markdown, or download as .md, .txt, or .pdf.",
                    },
                  ].map((s) => (
                    <li
                      key={s.n}
                      className="bg-card/60 border border-border/60 rounded-xl p-5 space-y-2"
                    >
                      <div className="text-xs font-mono text-primary">{s.n}</div>
                      <h3 className="font-semibold text-white">{s.h}</h3>
                      <p className="text-muted-foreground leading-relaxed">{s.p}</p>
                    </li>
                  ))}
                </ol>
                <p className="mt-8 text-center">
                  <Link
                    href="/how-it-works"
                    className="text-primary hover:underline text-sm font-medium"
                  >
                    Read the full guide →
                  </Link>
                </p>
              </section>

              <AdSlot slot="home-mid" format="leaderboard" />

              {/* SEO content: FAQ teaser */}
              <section aria-labelledby="faq-heading" className="border-t border-border/60 pt-16">
                <div className="text-center max-w-2xl mx-auto mb-10">
                  <h2 id="faq-heading" className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Common questions
                  </h2>
                </div>
                <dl className="space-y-6 max-w-2xl mx-auto">
                  {[
                    {
                      q: "Is Chat Extractor really free?",
                      a: "Yes. There's no signup, no paywall, and no usage limits.",
                    },
                    {
                      q: "Do you store my conversations?",
                      a: "No. We process every request in memory and discard it. We don't save the URL or the extracted conversation.",
                    },
                    {
                      q: "Which platforms work?",
                      a: "ChatGPT, Claude, Gemini, Grok, Perplexity, and DeepSeek public share links.",
                    },
                  ].map((f) => (
                    <div key={f.q}>
                      <dt className="font-semibold text-white flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary mt-1 shrink-0" />
                        <span>{f.q}</span>
                      </dt>
                      <dd className="text-muted-foreground mt-2 ml-6 text-sm leading-relaxed">
                        {f.a}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-8 text-center">
                  <Link
                    href="/faq"
                    className="text-primary hover:underline text-sm font-medium"
                  >
                    See all FAQs →
                  </Link>
                </p>
              </section>
            </motion.div>
          )}

          {extractMutation.isPending && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, filter: "blur(4px)" }}
              className="flex flex-col items-center justify-center py-24 space-y-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                <Loader2 className="w-12 h-12 text-primary animate-spin relative" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold text-white">Extracting conversation...</h3>
                <p className="text-muted-foreground font-mono text-sm">
                  Fetching and parsing data from the source
                </p>
              </div>
            </motion.div>
          )}

          {conversation && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="space-y-8"
            >
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={reset}
                      className="shrink-0 -ml-2 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-mono uppercase tracking-wider font-semibold">
                      {conversation.sourceLabel}
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    {conversation.title || "Extracted Conversation"}
                  </h2>
                  <a
                    href={conversation.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 inline-flex"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {conversation.url}
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={handleCopy} variant="secondary" className="gap-2">
                    <Copy className="w-4 h-4" /> Copy
                  </Button>
                  <Button onClick={handleDownloadMd} variant="secondary" className="gap-2">
                    <Download className="w-4 h-4" /> .md
                  </Button>
                  <Button onClick={handleDownloadTxt} variant="secondary" className="gap-2">
                    <FileText className="w-4 h-4" /> .txt
                  </Button>
                  <Button onClick={handleDownloadPdf} variant="secondary" className="gap-2">
                    <File className="w-4 h-4" /> .pdf
                  </Button>
                </div>
              </div>

              <AdSlot slot="result-top" format="leaderboard" />

              <div id="conversation-content" className="space-y-8 pb-24">
                {conversation.messages.map((msg, idx) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={idx}
                    className={`flex flex-col space-y-3 ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`flex items-center gap-2 text-sm font-mono tracking-wider ${msg.role === "user" ? "text-muted-foreground" : "text-primary"}`}
                    >
                      {msg.role === "assistant" && <Sparkles className="w-4 h-4" />}
                      <span className="uppercase font-semibold">
                        {msg.role}{" "}
                        {msg.model && (
                          <span className="opacity-60 normal-case font-normal ml-1">
                            ({msg.model})
                          </span>
                        )}
                      </span>
                    </div>
                    <div
                      className={`w-full max-w-[90%] sm:max-w-[85%] rounded-xl p-5 sm:p-6 ${
                        msg.role === "user"
                          ? "bg-secondary text-secondary-foreground rounded-tr-sm"
                          : "bg-card border border-border shadow-sm rounded-tl-sm"
                      }`}
                    >
                      <MarkdownRenderer content={msg.content} />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </Layout>
  );
}
