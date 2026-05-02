import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

type AnyElement = {
  type: string;
  name?: string;
  data?: string;
  children?: AnyElement[];
  parent?: AnyElement | null;
};
type Element = AnyElement;

/**
 * Convert an HTML fragment (commonly produced by an LLM frontend) into
 * reasonable Markdown. Best effort — preserves headings, lists, code, blockquotes,
 * inline emphasis, links, and tables. Falls back to plain text when in doubt.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  const $ = cheerio.load(`<div id="__root">${html}</div>`, null, false);
  const root = $("#__root").get(0);
  if (!root) return "";
  const out = renderNode($, root, { listDepth: 0, ordered: false }).trim();
  return collapseBlankLines(out);
}

interface RenderCtx {
  listDepth: number;
  ordered: boolean;
}

function renderNode($: CheerioAPI, node: any, ctx: RenderCtx): string {
  const $$ = $ as unknown as (el: any) => ReturnType<CheerioAPI>;
  if (!node) return "";
  if (node.type === "text") {
    return (node.data ?? "").replace(/\u00a0/g, " ");
  }
  if (node.type !== "tag" && node.type !== "script" && node.type !== "style") {
    return "";
  }
  if (node.type === "script" || node.type === "style") return "";

  const el = node as Element;
  const tag = (el.name || "").toLowerCase();
  const children = (el.children ?? []) as any[];
  const inner = children.map((c) => renderNode($, c, ctx)).join("");

  switch (tag) {
    case "br":
      return "\n";
    case "p":
    case "div":
    case "section":
    case "article":
      return `\n\n${inner.trim()}\n\n`;
    case "h1":
      return `\n\n# ${inner.trim()}\n\n`;
    case "h2":
      return `\n\n## ${inner.trim()}\n\n`;
    case "h3":
      return `\n\n### ${inner.trim()}\n\n`;
    case "h4":
      return `\n\n#### ${inner.trim()}\n\n`;
    case "h5":
      return `\n\n##### ${inner.trim()}\n\n`;
    case "h6":
      return `\n\n###### ${inner.trim()}\n\n`;
    case "strong":
    case "b":
      return `**${inner}**`;
    case "em":
    case "i":
      return `*${inner}*`;
    case "s":
    case "del":
    case "strike":
      return `~~${inner}~~`;
    case "code": {
      // Inline code if not inside <pre>
      const parent = el.parent as Element | null;
      if (parent && parent.name === "pre") return inner;
      return `\`${inner.replace(/`/g, "\\`")}\``;
    }
    case "pre": {
      // Try to pick up the language class from a child <code>
      let lang = "";
      for (const c of children) {
        if (c.type === "tag" && (c as Element).name === "code") {
          const cls =
            $(c as any).attr("class") ||
            $(c as any).attr("data-language") ||
            "";
          const m = cls.match(/(?:lang|language)-([a-z0-9+-]+)/i);
          if (m) lang = m[1];
          break;
        }
      }
      const text = $(el as any).text().replace(/\n+$/g, "");
      return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
    }
    case "blockquote": {
      const text = inner
        .trim()
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      return `\n\n${text}\n\n`;
    }
    case "ul":
    case "ol": {
      const ordered = tag === "ol";
      const indent = "  ".repeat(ctx.listDepth);
      let i = 1;
      const items: string[] = [];
      for (const c of children) {
        if (c.type !== "tag" || (c as Element).name !== "li") continue;
        const itemInner = (c.children ?? [])
          .map((cc: any) =>
            renderNode($, cc, { listDepth: ctx.listDepth + 1, ordered }),
          )
          .join("")
          .trim()
          .replace(/\n{3,}/g, "\n\n")
          .replace(/\n/g, `\n${indent}  `);
        const marker = ordered ? `${i}.` : "-";
        items.push(`${indent}${marker} ${itemInner}`);
        i++;
      }
      return `\n\n${items.join("\n")}\n\n`;
    }
    case "li":
      return inner;
    case "a": {
      const href = $(el as any).attr("href") || "";
      const text = inner.trim() || href;
      if (!href) return text;
      return `[${text}](${href})`;
    }
    case "img": {
      const src = $(el as any).attr("src") || "";
      const alt = $(el as any).attr("alt") || "";
      if (!src) return "";
      return `![${alt}](${src})`;
    }
    case "hr":
      return `\n\n---\n\n`;
    case "table":
      return `\n\n${renderTable($, el)}\n\n`;
    case "thead":
    case "tbody":
    case "tr":
    case "td":
    case "th":
      return inner;
    default:
      return inner;
  }
}

function renderTable($: CheerioAPI, table: any): string {
  const $$ = $ as unknown as (el: any) => ReturnType<CheerioAPI>;
  const rows: string[][] = [];
  $(table as any)
    .find("tr")
    .each((_, tr) => {
      const cells: string[] = [];
      $(tr as any)
        .find("th,td")
        .each((__, td) => {
          cells.push($(td as any).text().trim().replace(/\|/g, "\\|"));
        });
      if (cells.length) rows.push(cells);
    });
  if (!rows.length) return "";
  const header = rows[0];
  const sep = header.map(() => "---");
  const body = rows.slice(1);
  const fmt = (r: string[]) => `| ${r.join(" | ")} |`;
  return [fmt(header), fmt(sep), ...body.map(fmt)].join("\n");
}

function collapseBlankLines(s: string): string {
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

export function plainText(html: string): string {
  if (!html) return "";
  const $ = cheerio.load(`<div>${html}</div>`);
  return $("div").first().text().replace(/\u00a0/g, " ").trim();
}
