import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import go from "react-syntax-highlighter/dist/esm/languages/prism/go";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";

SyntaxHighlighter.registerLanguage("jsx", jsx);
SyntaxHighlighter.registerLanguage("tsx", tsx);
SyntaxHighlighter.registerLanguage("js", javascript);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("ts", typescript);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("py", python);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("sh", bash);
SyntaxHighlighter.registerLanguage("shell", bash);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("html", markup);
SyntaxHighlighter.registerLanguage("xml", markup);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("md", markdown);
SyntaxHighlighter.registerLanguage("markdown", markdown);
SyntaxHighlighter.registerLanguage("sql", sql);
SyntaxHighlighter.registerLanguage("go", go);
SyntaxHighlighter.registerLanguage("rust", rust);
SyntaxHighlighter.registerLanguage("rs", rust);
SyntaxHighlighter.registerLanguage("java", java);

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

const MarkdownRendererImpl: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-invert max-w-none prose-pre:bg-[#1e1e1e] prose-pre:border prose-pre:border-border prose-pre:rounded-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRendererImpl;
