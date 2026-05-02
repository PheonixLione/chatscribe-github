import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownRendererProps {
  content: string;
}

type CodeProps = React.ComponentPropsWithoutRef<"code"> & {
  inline?: boolean;
  node?: { position?: { start: { line: number }; end: { line: number } } };
};

const components: Components = {
  code(props) {
    const { inline, className, children, node, ...rest } = props as CodeProps;
    const match = /language-(\w+)/.exec(className || "");
    const text = String(children ?? "").replace(/\n$/, "");
    // react-markdown v9 stopped passing `inline` for some renderers, so
    // we also derive "is this a block?" from: a language hint, a multi-
    // line body, or a multi-line source position. This keeps unlabeled
    // fenced blocks (```\n...\n```) rendering as block elements instead
    // of collapsing into an inline `<code>`.
    const looksBlockFromPosition =
      !!node?.position && node.position.end.line > node.position.start.line;
    const isBlock =
      inline === false ||
      Boolean(match) ||
      text.includes("\n") ||
      looksBlockFromPosition;

    if (isBlock) {
      if (match) {
        return (
          <SyntaxHighlighter
            style={vscDarkPlus as Record<string, React.CSSProperties>}
            language={match[1]}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: "1rem",
              background: "transparent",
            }}
          >
            {text}
          </SyntaxHighlighter>
        );
      }
      // Unlabeled fenced block — render as a real block `<pre><code>` so
      // newlines, indentation and copy/paste behave correctly.
      return (
        <pre className="bg-[#1e1e1e] border border-border rounded-md p-4 overflow-x-auto">
          <code className="font-mono text-sm whitespace-pre" {...rest}>
            {text}
          </code>
        </pre>
      );
    }
    return (
      <code
        className={`${className ?? ""} bg-muted px-1.5 py-0.5 rounded-md font-mono text-sm`}
        {...rest}
      >
        {children}
      </code>
    );
  },
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-invert max-w-none prose-pre:bg-[#1e1e1e] prose-pre:border prose-pre:border-border prose-pre:rounded-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};
