import React, { lazy, Suspense } from "react";

interface MarkdownRendererProps {
  content: string;
}

const LazyMarkdown = lazy(() => import("./MarkdownRendererImpl"));

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <Suspense
      fallback={
        <div className="prose prose-invert max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-sm">{content}</pre>
        </div>
      }
    >
      <LazyMarkdown content={content} />
    </Suspense>
  );
};
