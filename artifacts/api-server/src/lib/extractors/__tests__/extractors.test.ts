import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { extractFromUrl, ExtractError } from "../index";
import { installFetchMock, restoreFetch, loadFixture } from "./helpers";

interface Case {
  name: string;
  url: string;
  fixture: string;
  expectedSource: string;
  expectedTitle?: string;
  expectedFirstUserContains: string;
  expectedFirstAssistantContains: string;
  expectedRoles: ("user" | "assistant" | "system" | "tool")[];
}

const CASES: Case[] = [
  {
    name: "chatgpt",
    url: "https://chatgpt.com/share/abcd-1234",
    fixture: "chatgpt.html",
    expectedSource: "chatgpt",
    expectedTitle: "Capital of France",
    expectedFirstUserContains: "capital of France",
    expectedFirstAssistantContains: "Paris",
    expectedRoles: ["user", "assistant", "user", "assistant"],
  },
  {
    name: "claude",
    url: "https://claude.ai/share/abcd-1234",
    fixture: "claude.html",
    expectedSource: "claude",
    expectedTitle: "Recursion explained",
    expectedFirstUserContains: "recursion",
    expectedFirstAssistantContains: "function calls itself",
    expectedRoles: ["user", "assistant", "user", "assistant"],
  },
  {
    name: "gemini",
    url: "https://gemini.google.com/share/abcd1234",
    fixture: "gemini.html",
    expectedSource: "gemini",
    expectedTitle: "Best beaches in Portugal",
    expectedFirstUserContains: "best beaches in Portugal",
    expectedFirstAssistantContains: "Praia da Marinha",
    expectedRoles: ["user", "assistant", "user", "assistant"],
  },
  {
    name: "grok",
    url: "https://grok.com/share/abcd1234",
    fixture: "grok.html",
    expectedSource: "grok",
    expectedTitle: "Why is the sky blue",
    expectedFirstUserContains: "sky blue",
    expectedFirstAssistantContains: "Rayleigh",
    expectedRoles: ["user", "assistant", "user", "assistant"],
  },
  {
    name: "perplexity",
    url: "https://www.perplexity.ai/search/quantum-entanglement-abcd1234",
    fixture: "perplexity.html",
    expectedSource: "perplexity",
    expectedTitle: "What is quantum entanglement",
    expectedFirstUserContains: "quantum entanglement",
    expectedFirstAssistantContains: "Quantum entanglement",
    expectedRoles: ["user", "assistant"],
  },
  {
    name: "deepseek",
    url: "https://chat.deepseek.com/share/abcd1234",
    fixture: "deepseek.html",
    expectedSource: "deepseek",
    expectedFirstUserContains: "three languages",
    expectedFirstAssistantContains: "Hello",
    expectedRoles: ["user", "assistant", "user", "assistant"],
  },
];

describe("extractors — happy path per platform", () => {
  afterEach(() => restoreFetch());

  for (const c of CASES) {
    it(`${c.name} parses fixture into a Conversation`, async () => {
      const html = loadFixture(c.fixture);
      installFetchMock(() => ({ status: 200, body: html }));

      const conv = await extractFromUrl(c.url);

      assert.equal(conv.source, c.expectedSource);
      assert.equal(conv.url, c.url);
      assert.ok(conv.extractedAt, "extractedAt should be set");
      assert.deepEqual(
        conv.messages.map((m) => m.role),
        c.expectedRoles,
        `${c.name}: roles mismatch`,
      );
      const firstUser = conv.messages.find((m) => m.role === "user");
      const firstAssistant = conv.messages.find((m) => m.role === "assistant");
      assert.ok(firstUser, "expected at least one user message");
      assert.ok(firstAssistant, "expected at least one assistant message");
      assert.match(firstUser!.content, new RegExp(c.expectedFirstUserContains, "i"));
      assert.match(
        firstAssistant!.content,
        new RegExp(c.expectedFirstAssistantContains, "i"),
      );
      if (c.expectedTitle) {
        assert.ok(
          conv.title && conv.title.includes(c.expectedTitle),
          `${c.name}: expected title to contain "${c.expectedTitle}", got "${conv.title}"`,
        );
      }
    });
  }
});

describe("extractors — private/deleted page detection", () => {
  afterEach(() => restoreFetch());

  it("rejects pages whose <title> matches the sign-in marker", async () => {
    const html = loadFixture("private.html");
    installFetchMock(() => ({ status: 200, body: html }));

    await assert.rejects(
      () => extractFromUrl("https://chatgpt.com/share/private-1"),
      (err: unknown) => {
        assert.ok(err instanceof ExtractError, "expected ExtractError");
        assert.equal((err as ExtractError).code, "not_public");
        assert.equal((err as ExtractError).status, 404);
        return true;
      },
    );
  });

  it("rejects HTTP 404 with not_public", async () => {
    installFetchMock(() => ({ status: 404, body: "not found" }));
    await assert.rejects(
      () => extractFromUrl("https://chatgpt.com/share/missing-1"),
      (err: unknown) => {
        assert.ok(err instanceof ExtractError);
        assert.equal((err as ExtractError).code, "not_public");
        return true;
      },
    );
  });

  it("rejects HTTP 403 with not_public", async () => {
    installFetchMock(() => ({ status: 403, body: "forbidden" }));
    await assert.rejects(
      () => extractFromUrl("https://claude.ai/share/forbidden-1"),
      (err: unknown) => {
        assert.ok(err instanceof ExtractError);
        assert.equal((err as ExtractError).code, "not_public");
        return true;
      },
    );
  });
});

describe("extractors — redirect SSRF rejection", () => {
  afterEach(() => restoreFetch());

  it("refuses a 302 that hops outside the source's allowlist", async () => {
    installFetchMock((url) => {
      if (url.startsWith("https://chatgpt.com/share/")) {
        return {
          status: 302,
          headers: { location: "https://evil.example.com/steal" },
        };
      }
      // Should never be called — but guard anyway.
      return { status: 200, body: "<html></html>" };
    });

    await assert.rejects(
      () => extractFromUrl("https://chatgpt.com/share/redirect-1"),
      (err: unknown) => {
        assert.ok(err instanceof ExtractError);
        assert.equal((err as ExtractError).code, "unsupported_url");
        assert.equal((err as ExtractError).status, 400);
        return true;
      },
    );
  });

  it("refuses a non-http(s) redirect target", async () => {
    installFetchMock(() => ({
      status: 302,
      headers: { location: "file:///etc/passwd" },
    }));

    await assert.rejects(
      () => extractFromUrl("https://chatgpt.com/share/file-redirect"),
      (err: unknown) => {
        assert.ok(err instanceof ExtractError);
        // The non-http(s) check happens before the host allowlist.
        assert.equal((err as ExtractError).code, "fetch_failed");
        return true;
      },
    );
  });

  it("allows a same-host redirect (chatgpt.com → chatgpt.com)", async () => {
    const html = loadFixture("chatgpt.html");
    let calls = 0;
    installFetchMock((url) => {
      calls++;
      if (calls === 1) {
        return {
          status: 301,
          headers: { location: "https://chatgpt.com/share/final-id" },
        };
      }
      assert.equal(url, "https://chatgpt.com/share/final-id");
      return { status: 200, body: html };
    });

    const conv = await extractFromUrl("https://chatgpt.com/share/start-id");
    assert.equal(conv.source, "chatgpt");
    assert.ok(conv.messages.length > 0);
  });

  it("allows g.co → gemini.google.com cross-host redirect (whitelisted)", async () => {
    const html = loadFixture("gemini.html");
    let calls = 0;
    installFetchMock(() => {
      calls++;
      if (calls === 1) {
        return {
          status: 302,
          headers: {
            location: "https://gemini.google.com/share/abcd1234",
          },
        };
      }
      return { status: 200, body: html };
    });

    const conv = await extractFromUrl("https://g.co/gemini/share/abcd1234");
    assert.equal(conv.source, "gemini");
  });
});

describe("extractors — URL validation", () => {
  afterEach(() => restoreFetch());

  it("rejects garbage input as unsupported_url", async () => {
    await assert.rejects(
      () => extractFromUrl("not a url at all"),
      (err: unknown) => {
        assert.ok(err instanceof ExtractError);
        assert.equal((err as ExtractError).code, "unsupported_url");
        return true;
      },
    );
  });

  it("rejects unknown hosts as unsupported_url", async () => {
    await assert.rejects(
      () => extractFromUrl("https://example.com/share/whatever"),
      (err: unknown) => {
        assert.ok(err instanceof ExtractError);
        assert.equal((err as ExtractError).code, "unsupported_url");
        return true;
      },
    );
  });

  it("rejects ftp:// links as unsupported_url", async () => {
    await assert.rejects(
      () => extractFromUrl("ftp://chatgpt.com/share/x"),
      (err: unknown) => {
        assert.ok(err instanceof ExtractError);
        assert.equal((err as ExtractError).code, "unsupported_url");
        return true;
      },
    );
  });
});
