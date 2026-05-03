import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";
import { SITE_NAME } from "@/lib/seo";

const NAV: { href: string; label: string }[] = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/supported-platforms", label: "Platforms" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
];

function Header() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <nav
        className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between"
        aria-label="Primary"
      >
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-white hover:text-primary transition-colors"
          onClick={() => setOpen(false)}
        >
          <Sparkles className="w-4 h-4 text-primary" />
          <span>{SITE_NAME}</span>
        </Link>

        <ul className="hidden md:flex items-center gap-6 text-sm">
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
                      : "text-muted-foreground hover:text-white")
                  }
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          className="md:hidden p-2 -mr-2 text-muted-foreground hover:text-white"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {open && (
        <ul className="md:hidden border-t border-border/60 bg-background px-4 py-3 space-y-1 text-sm">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className="block py-2 text-muted-foreground hover:text-white"
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
  return (
    <footer className="border-t border-border/60 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-10 grid gap-8 sm:grid-cols-2 md:grid-cols-4 text-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-semibold text-white">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>{SITE_NAME}</span>
          </div>
          <p className="text-muted-foreground">
            Free, instant AI chat extractor. No signup, no storage.
          </p>
        </div>

        <div>
          <h2 className="text-white font-medium mb-3">Product</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link href="/" className="hover:text-white">Extract a chat</Link></li>
            <li><Link href="/how-it-works" className="hover:text-white">How it works</Link></li>
            <li><Link href="/supported-platforms" className="hover:text-white">Supported platforms</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="text-white font-medium mb-3">Resources</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link href="/faq" className="hover:text-white">FAQ</Link></li>
            <li><Link href="/about" className="hover:text-white">About</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="text-white font-medium mb-3">Legal</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>© {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</span>
          <span className="font-mono">Not affiliated with OpenAI, Anthropic, Google, xAI, Perplexity, or DeepSeek.</span>
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
