import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdblockGuard } from "@/components/AdblockGuard";
import { Home } from "@/pages/Home";

const NotFound = lazy(() => import("@/pages/not-found"));
const HowItWorks = lazy(() => import("@/pages/HowItWorks"));
const SupportedPlatforms = lazy(() => import("@/pages/SupportedPlatforms"));
const Faq = lazy(() => import("@/pages/Faq"));
const About = lazy(() => import("@/pages/About"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));
const GuidesIndex = lazy(() => import("@/pages/guides/GuidesIndex"));
const ConvertAiChatToMarkdown = lazy(
  () => import("@/pages/guides/ConvertAiChatToMarkdown"),
);
const DownloadGeminiChat = lazy(
  () => import("@/pages/guides/DownloadGeminiChat"),
);
const ExportClaudeToMarkdown = lazy(
  () => import("@/pages/guides/ExportClaudeToMarkdown"),
);
const SaveAiConversations = lazy(
  () => import("@/pages/guides/SaveAiConversations"),
);
const SaveChatgptAsPdf = lazy(() => import("@/pages/guides/SaveChatgptAsPdf"));
const SaveGrokConversation = lazy(
  () => import("@/pages/guides/SaveGrokConversation"),
);

const queryClient = new QueryClient();

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground text-sm">
      Loading…
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/how-it-works" component={HowItWorks} />
        <Route path="/supported-platforms" component={SupportedPlatforms} />
        <Route path="/faq" component={Faq} />
        <Route path="/about" component={About} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/guides" component={GuidesIndex} />
        <Route
          path="/guides/save-ai-conversations"
          component={SaveAiConversations}
        />
        <Route
          path="/guides/save-chatgpt-as-pdf"
          component={SaveChatgptAsPdf}
        />
        <Route
          path="/guides/export-claude-to-markdown"
          component={ExportClaudeToMarkdown}
        />
        <Route
          path="/guides/download-gemini-chat"
          component={DownloadGeminiChat}
        />
        <Route
          path="/guides/save-grok-conversation"
          component={SaveGrokConversation}
        />
        <Route
          path="/guides/convert-ai-chat-to-markdown"
          component={ConvertAiChatToMarkdown}
        />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AdblockGuard>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AdblockGuard>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
