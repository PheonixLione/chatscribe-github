import { ReactNode } from "react";

interface ContentPageProps {
  eyebrow?: string;
  title: string;
  intro?: string;
  children: ReactNode;
}

/**
 * Shared shell for long-form / SEO content pages. Uses Tailwind Typography
 * (`prose`) so simple Markdown-like JSX inside `children` stays consistent.
 */
export function ContentPage({ eyebrow, title, intro, children }: ContentPageProps) {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 sm:py-20">
      <header className="mb-10 space-y-3">
        {eyebrow && (
          <p className="text-xs font-mono uppercase tracking-wider text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          {title}
        </h1>
        {intro && (
          <p className="text-lg text-muted-foreground">{intro}</p>
        )}
      </header>
      <article
        className="
          prose prose-invert max-w-none
          prose-headings:text-white prose-headings:tracking-tight
          prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
          prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
          prose-p:text-muted-foreground prose-p:leading-relaxed
          prose-li:text-muted-foreground
          prose-strong:text-white
          prose-a:text-primary hover:prose-a:underline
          prose-code:text-primary prose-code:before:content-none prose-code:after:content-none
        "
      >
        {children}
      </article>
    </main>
  );
}
