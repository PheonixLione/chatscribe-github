import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";

/**
 * Convert an HTML fragment (commonly produced by an LLM frontend) into
 * Markdown. Best effort — preserves headings, lists, code, blockquotes,
 * inline emphasis, links, and tables.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  const $ = cheerio.load(`<div id="__root">${html}</div>`, null, false);
  const root = $("#__root").get(0);
  if (!root) return "";
  const out = renderNode($, root, { listDepth: 0 }).trim();
  return collapseBlankLines(out);
}

interface RenderCtx {
  listDepth: number;
}

function isElement(node: AnyNode): node is Element {
  return node.type === "tag";
}

function getChildren(node: AnyNode): AnyNode[] {
  if ("children" in node && Array.isArray(node.children)) {
    return node.children as AnyNode[];
  }
  return [];
}

function renderNode($: CheerioAPI, node: AnyNode, ctx: RenderCtx): string {
  if (node.type === "text") {
    return ((node as { data?: string }).data ?? "").replace(/\u00a0/g, " ");
  }
  if (node.type === "script" || node.type === "style") return "";
  if (!isElement(node)) return "";

  const tag = (node.name || "").toLowerCase();
  const children = getChildren(node);
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
      const parent = node.parent;
      if (parent && isElement(parent as AnyNode) && (parent as Element).name === "pre") {
        return inner;
      }
      return `\`${inner.replace(/`/g, "\\`")}\``;
    }
    case "pre": {
      let lang = "";
      for (const c of children) {
        if (isElement(c) && c.name === "code") {
          const cls = $(c).attr("class") || $(c).attr("data-language") || "";
          const m = cls.match(/(?:lang|language)-([a-z0-9+-]+)/i);
          if (m) lang = m[1];
          break;
        }
      }
      const text = $(node).text().replace(/\n+$/g, "");
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
        if (!isElement(c) || c.name !== "li") continue;
        const itemInner = getChildren(c)
          .map((cc) => renderNode($, cc, { listDepth: ctx.listDepth + 1 }))
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
      const href = $(node).attr("href") || "";
      const text = inner.trim() || href;
      if (!href) return text;
      return `[${text}](${href})`;
    }
    case "img": {
      const src = $(node).attr("src") || "";
      const alt = $(node).attr("alt") || "";
      if (!src) return "";
      return `![${alt}](${src})`;
    }
    case "hr":
      return `\n\n---\n\n`;
    case "table":
      return `\n\n${renderTable($, node)}\n\n`;
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

function renderTable($: CheerioAPI, table: Element): string {
  const rows: string[][] = [];
  $(table)
    .find("tr")
    .each((_, tr) => {
      const cells: string[] = [];
      $(tr)
        .find("th,td")
        .each((__, td) => {
          cells.push($(td).text().trim().replace(/\|/g, "\\|"));
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
