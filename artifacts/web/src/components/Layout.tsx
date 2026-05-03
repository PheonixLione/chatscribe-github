import { ReactNode, MouseEvent } from "react";
import { Link, useLocation } from "wouter";
import { Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";
import { SITE_NAME } from "@/lib/seo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const HOME_RESET_EVENT = "chatscribe:home-reset";

/**
 * Click handler for "go home / start over" links (header title, footer
 * "Extract a chat"). Always navigates to "/" via wouter; additionally
 * dispatches a window event so the Home page can reset its local
 * conversation state, scroll to top, and re-focus the URL input even
 * when we are already on "/".
 */
function useGoHome() {
  const [, navigate] = useLocation();
  return (e: MouseEvent<HTMLAnchorElement>) => {
    // Honor modifier-clicks (open in new tab/window/etc.).
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) {
      return;
    }
    e.preventDefault();
    navigate("/");
    window.dispatchEvent(new Event(HOME_RESET_EVENT));
  };
}

const NAV: { href: string; label: string }[] = [
  { href: "/guides", label: "Guides" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/supported-platforms", label: "Platforms" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
];

function Header() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const goHome = useGoHome();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <nav
        className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between"
        aria-label="Primary"
      >
        <a
          href="/"
          className="flex items-center gap-2 font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
          onClick={(e) => {
            setOpen(false);
            goHome(e);
          }}
          aria-label={`${SITE_NAME} — back to home`}
        >
          <Sparkles className="w-4 h-4 text-primary" />
          <span>{SITE_NAME}</span>
        </a>

        <div className="hidden md:flex items-center gap-6 text-sm">
          <ul className="flex items-center gap-6">
            {NAV.map((item) => {
              const active = location === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={
                      "transition-colors " +
                      (active
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <ThemeToggle />
        </div>

        <div className="md:hidden flex items-center gap-1 -mr-2">
          <ThemeToggle />
          <button
            type="button"
            className="p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <ul className="md:hidden border-t border-border/60 bg-background px-4 py-3 space-y-1 text-sm">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className="block py-2 text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}

function Footer() {
  const goHome = useGoHome();
  return (
    <footer className="border-t border-border/60 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-10 grid gap-8 sm:grid-cols-2 md:grid-cols-4 text-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>{SITE_NAME}</span>
          </div>
          <p className="text-muted-foreground">
            Free, instant AI chat extractor. No signup, no storage.
          </p>
        </div>

        <div>
          <h2 className="text-foreground font-medium mb-3">Product</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li><a href="/" onClick={goHome} className="hover:text-foreground cursor-pointer">Extract a chat</a></li>
            <li><Link href="/how-it-works" className="hover:text-foreground">How it works</Link></li>
            <li><Link href="/supported-platforms" className="hover:text-foreground">Supported platforms</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="text-foreground font-medium mb-3">Resources</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link href="/guides" className="hover:text-foreground">Guides</Link></li>
            <li><Link href="/guides/save-ai-conversations" className="hover:text-foreground">Save AI conversations</Link></li>
            <li><Link href="/guides/save-chatgpt-as-pdf" className="hover:text-foreground">ChatGPT to PDF</Link></li>
            <li><Link href="/guides/export-claude-to-markdown" className="hover:text-foreground">Claude to Markdown</Link></li>
            <li><Link href="/faq" className="hover:text-foreground">FAQ</Link></li>
            <li><Link href="/about" className="hover:text-foreground">About</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="text-foreground font-medium mb-3">Legal</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link href="/privacy" className="hover:text-foreground">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-foreground">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>© {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</span>
          <span className="font-mono">Not affiliated with OpenAI, Anthropic, Google, xAI, or DeepSeek.</span>
        </div>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans selection:bg-primary/30">
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
