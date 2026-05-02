import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { htmlToMarkdown, plainText } from "../markdown";

describe("htmlToMarkdown — headings", () => {
  it("renders h1..h6 with the right number of #s", () => {
    const md = htmlToMarkdown(
      "<h1>One</h1><h2>Two</h2><h3>Three</h3><h4>Four</h4><h5>Five</h5><h6>Six</h6>",
    );
    assert.match(md, /^# One$/m);
    assert.match(md, /^## Two$/m);
    assert.match(md, /^### Three$/m);
    assert.match(md, /^#### Four$/m);
    assert.match(md, /^##### Five$/m);
    assert.match(md, /^###### Six$/m);
  });

  it("trims inner whitespace inside headings", () => {
    const md = htmlToMarkdown("<h2>   Hello   </h2>");
    assert.match(md, /^## Hello$/m);
  });
});

describe("htmlToMarkdown — code blocks", () => {
  it("emits a fenced block with the language hint from class='language-X'", () => {
    const md = htmlToMarkdown(
      '<pre><code class="language-python">print("hi")\n</code></pre>',
    );
    assert.match(md, /^```python$/m);
    assert.match(md, /^print\("hi"\)$/m);
    assert.match(md, /^```$/m);
  });

  it("emits a fenced block with no language when class is missing", () => {
    const md = htmlToMarkdown("<pre><code>const x = 1;</code></pre>");
    assert.ok(md.includes("```\nconst x = 1;\n```"));
  });

  it("inline <code> uses backticks", () => {
    const md = htmlToMarkdown("<p>Use <code>npm install</code> first.</p>");
    assert.ok(md.includes("`npm install`"));
  });

  it("escapes backticks inside inline code", () => {
    const md = htmlToMarkdown("<p><code>a`b</code></p>");
    assert.ok(md.includes("`a\\`b`"));
  });
});

describe("htmlToMarkdown — lists", () => {
  it("renders unordered lists with - markers", () => {
    const md = htmlToMarkdown("<ul><li>alpha</li><li>beta</li><li>gamma</li></ul>");
    assert.match(md, /^- alpha$/m);
    assert.match(md, /^- beta$/m);
    assert.match(md, /^- gamma$/m);
  });

  it("renders ordered lists with numeric markers", () => {
    const md = htmlToMarkdown("<ol><li>first</li><li>second</li><li>third</li></ol>");
    assert.match(md, /^1\. first$/m);
    assert.match(md, /^2\. second$/m);
    assert.match(md, /^3\. third$/m);
  });

  it("indents nested lists", () => {
    const md = htmlToMarkdown(
      "<ul><li>outer<ul><li>inner</li></ul></li></ul>",
    );
    // The nested item should be indented under its parent.
    assert.match(md, /- outer/);
    assert.match(md, /  - inner/);
  });
});

describe("htmlToMarkdown — tables", () => {
  it("renders a basic table with header separator", () => {
    const md = htmlToMarkdown(
      "<table>" +
        "<thead><tr><th>Name</th><th>Score</th></tr></thead>" +
        "<tbody><tr><td>Alice</td><td>9</td></tr><tr><td>Bob</td><td>7</td></tr></tbody>" +
        "</table>",
    );
    assert.match(md, /^\| Name \| Score \|$/m);
    assert.match(md, /^\| --- \| --- \|$/m);
    assert.match(md, /^\| Alice \| 9 \|$/m);
    assert.match(md, /^\| Bob \| 7 \|$/m);
  });

  it("escapes pipes inside cells", () => {
    const md = htmlToMarkdown(
      "<table><tr><th>A</th></tr><tr><td>x | y</td></tr></table>",
    );
    assert.ok(md.includes("x \\| y"));
  });
});

describe("htmlToMarkdown — misc", () => {
  it("handles empty input safely", () => {
    assert.equal(htmlToMarkdown(""), "");
    assert.equal(htmlToMarkdown("   "), "");
  });

  it("renders bold, italic, and strikethrough", () => {
    const md = htmlToMarkdown(
      "<p><strong>b</strong> <em>i</em> <s>s</s></p>",
    );
    assert.ok(md.includes("**b**"));
    assert.ok(md.includes("*i*"));
    assert.ok(md.includes("~~s~~"));
  });

  it("renders links with href", () => {
    const md = htmlToMarkdown('<a href="https://example.com">site</a>');
    assert.ok(md.includes("[site](https://example.com)"));
  });

  it("renders blockquotes prefixed with >", () => {
    const md = htmlToMarkdown("<blockquote>hello world</blockquote>");
    assert.match(md, /^> hello world$/m);
  });

  it("ignores <script> and <style> contents", () => {
    const md = htmlToMarkdown(
      "<p>before</p><script>alert(1)</script><style>body{}</style><p>after</p>",
    );
    assert.ok(!md.includes("alert(1)"));
    assert.ok(!md.includes("body{}"));
    assert.ok(md.includes("before"));
    assert.ok(md.includes("after"));
  });

  it("collapses runs of blank lines", () => {
    const md = htmlToMarkdown("<p>a</p><p></p><p></p><p>b</p>");
    assert.ok(!/\n\n\n/.test(md), "should not contain 3 consecutive newlines");
  });
});

describe("plainText", () => {
  it("extracts visible text", () => {
    assert.equal(plainText("<p>Hello <b>world</b></p>"), "Hello world");
  });

  it("normalizes &nbsp;", () => {
    assert.equal(plainText("<p>a&nbsp;b</p>"), "a b");
  });

  it("returns empty string for empty input", () => {
    assert.equal(plainText(""), "");
  });
});
