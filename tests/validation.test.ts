import { describe, expect, it } from "vitest";
import { validateArticle } from "../src/validation";
import type { RenderedArticle } from "../src/types";

function article(overrides: Partial<RenderedArticle> = {}): RenderedArticle {
  return {
    html: "<p>正文</p>",
    sourcePath: "文章.md",
    warnings: [],
    metadata: { title: "标题", author: "作者", digest: "", cover: "cover.png", sourceUrl: "", mode: "styled", theme: "default", useFirstH1AsTitle: false },
    ...overrides
  };
}

describe("article validation", () => {
  it("accepts a minimal article", () => expect(validateArticle(article())).toEqual([]));

  it("rejects invalid metadata and oversized HTML", () => {
    const result = validateArticle(article({
      html: `<p>${"字".repeat(20_001)}</p>`,
      metadata: { title: "", author: "作者作者作者作者作者作者作者作者作者", digest: "", cover: "", sourceUrl: "http://unsafe.test", mode: "styled", theme: "default", useFirstH1AsTitle: false }
    }));
    expect(result.join(" ")).toContain("标题不能为空");
    expect(result.join(" ")).toContain("作者超过");
    expect(result.join(" ")).toContain("https");
    expect(result.join(" ")).toContain("20,000");
    expect(result.join(" ")).toMatch(/20,00\d/);
  });
});
