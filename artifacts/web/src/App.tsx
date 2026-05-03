import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdblockGuard } from "@/components/AdblockGuard";
import NotFound from "@/pages/not-found";
import { Home } from "@/pages/Home";
import HowItWorks from "@/pages/HowItWorks";
import SupportedPlatforms from "@/pages/SupportedPlatforms";
import Faq from "@/pages/Faq";
import About from "@/pages/About";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import GuidesIndex from "@/pages/guides/GuidesIndex";
import SaveAiConversations from "@/pages/guides/SaveAiConversations";
import SaveChatgptAsPdf from "@/pages/guides/SaveChatgptAsPdf";
import ExportClaudeToMarkdown from "@/pages/guides/ExportClaudeToMarkdown";
import DownloadGeminiChat from "@/pages/guides/DownloadGeminiChat";
import SaveGrokConversation from "@/pages/guides/SaveGrokConversation";
import ConvertAiChatToMarkdown from "@/pages/guides/ConvertAiChatToMarkdown";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/supported-platforms" component={SupportedPlatforms} />
      <Route path="/faq" component={Faq} />
      <Route path="/about" component={About} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/guides" component={GuidesIndex} />
      <Route path="/guides/save-ai-conversations" component={SaveAiConversations} />
      <Route path="/guides/save-chatgpt-as-pdf" component={SaveChatgptAsPdf} />
      <Route path="/guides/export-claude-to-markdown" component={ExportClaudeToMarkdown} />
      <Route path="/guides/download-gemini-chat" component={DownloadGeminiChat} />
      <Route path="/guides/save-grok-conversation" component={SaveGrokConversation} />
      <Route path="/guides/convert-ai-chat-to-markdown" component={ConvertAiChatToMarkdown} />
      <Route component={NotFound} />
    </Switch>
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
