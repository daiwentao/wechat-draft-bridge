import "./setup";
import { describe, expect, it } from "vitest";
import { draftBindingFromFrontmatter, metadataFromFrontmatter, stripFrontmatter } from "../src/core/frontmatter";
import { inlineArticleCss } from "../src/core/css-inliner";
import { normalizeObsidianRenderedDom } from "../src/core/obsidian-render-normalizer";
import { prepareMarkdown, renderMarkdownSource } from "../src/core/source-renderer";
import { sanitizeWechatHtml } from "../src/core/wechat-sanitizer";

describe("Markdown source mode", () => {
  it("removes frontmatter and preserves escaped Markdown text", () => {
    const html = renderMarkdownSource("---\nprivate: yes\n---\n# 标题\n\n<script>alert(1)</script>\n**粗体**");
    expect(html).not.toContain("private: yes");
    expect(html).toContain("# 标题");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("**粗体**");
    expect(html).not.toMatch(/<pre|<code|style=/);
  });

  it("preserves blank lines, indentation, repeated spaces and tabs without styles", () => {
    const html = renderMarkdownSource("第一行\n\n  缩进  两格\t结尾");
    expect(html).toContain("第一行<br><br>");
    expect(html).toContain("&nbsp;&nbsp;缩进&nbsp;&nbsp;两格&nbsp;&nbsp;&nbsp;&nbsp;结尾");
    expect(html).not.toContain("style=");
  });

  it("uses and removes the first level-one heading while ignoring fenced code", () => {
    const markdown = "```md\n# 代码里的标题\n```\n# 正文标题\n\n内容";
    const prepared = prepareMarkdown(markdown, true);
    expect(prepared.firstH1).toBe("正文标题");
    expect(prepared.body).toContain("# 代码里的标题");
    expect(prepared.body).not.toContain("# 正文标题");
    expect(renderMarkdownSource(markdown, true)).not.toContain("# 正文标题");
  });

  it("does not remove horizontal rules inside the body", () => {
    expect(stripFrontmatter("正文\n---\n尾部")).toBe("正文\n---\n尾部");
  });

  it("maps supported frontmatter and defaults", () => {
    const metadata = metadataFromFrontmatter(
      { "wechat-title": "自定义标题", "wechat-mode": "source", "wechat-theme": "Themes/a.css" },
      "文件名",
      { appId: "", appSecretKey: "secret-ref", defaultAuthor: "默认作者", defaultCover: "cover.jpg", defaultMode: "styled", defaultUseFirstH1AsTitle: false, customCssPath: "" }
    );
    expect(metadata).toMatchObject({ title: "自定义标题", author: "默认作者", cover: "cover.jpg", mode: "source", theme: "Themes/a.css", useFirstH1AsTitle: false });
  });

  it("reads a synchronized WeChat draft binding from frontmatter", () => {
    expect(draftBindingFromFrontmatter({
      "wechat-draft": {
        "media-id": "draft-media-id",
        account: "wx-test",
        "article-index": 0,
        "updated-at": "2026-09-23T07:30:00.000Z"
      }
    })).toEqual({
      mediaId: "draft-media-id",
      account: "wx-test",
      articleIndex: 0,
      updatedAt: "2026-09-23T07:30:00.000Z"
    });
  });

  it("accepts a legacy top-level draft id", () => {
    expect(draftBindingFromFrontmatter({ "wechat-draft-id": "legacy-id" })).toMatchObject({ mediaId: "legacy-id", articleIndex: 0 });
  });
});

describe("styled mode primitives", () => {
  it("inlines custom CSS after the default theme", () => {
    const result = inlineArticleCss("<h2>标题</h2><p>正文</p>", ".wechat-article h2 { color: rgb(255, 0, 0); }");
    expect(result.html).toMatch(/color:\s*rgb\(255, 0, 0\)/);
    expect(result.html).not.toContain("<style");
  });

  it("supports Obsidian preview selectors and resolves theme color variables", () => {
    const result = inlineArticleCss(
      "<h2>标题</h2>",
      ".theme-dark .markdown-preview-view h2 { color: var(--text-accent); }",
      { themeClass: "theme-dark", cssVariables: { "--text-accent": "#7c3aed" } }
    );
    expect(result.html).toMatch(/color:\s*#7c3aed/i);
    expect(result.html).not.toContain("var(--text-accent)");
  });

  it("supports Markdown Here wrapper themes", () => {
    const result = inlineArticleCss(
      "<p>普通正文</p><blockquote><p>引用</p></blockquote>",
      ".markdown-here-wrapper { color: #595959; } .markdown-here-wrapper blockquote { color: #777777; }"
    );
    expect(result.html).toMatch(/class="[^"]*markdown-here-wrapper[^"]*"[^>]*style="[^"]*color:\s*#595959/i);
    expect(result.html).toMatch(/<blockquote style="[^"]*color:\s*#777777/i);
  });

  it("warns about unsupported CSS features", () => {
    const result = inlineArticleCss("<p>正文</p>", "p::before { content: 'x' } @media (max-width: 1px) {} ");
    expect(result.warnings.join(" ")).toContain("伪元素");
    expect(result.warnings.join(" ")).toContain("媒体查询");
  });

  it("removes scripts, handlers and unsafe styles", () => {
    const result = sanitizeWechatHtml('<section><p onclick="steal()" style="color:red;position:fixed;background-image:url(javascript:x)">安全</p><script>alert(1)</script><a href="javascript:x">坏链接</a></section>');
    expect(result.html).toContain("安全");
    expect(result.html).not.toMatch(/script|alert\(1\)|onclick|javascript|position/i);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("keeps data images for the later upload stage", () => {
    const result = sanitizeWechatHtml('<p><img src="data:image/png;base64,AAAA" alt="x"></p>');
    expect(result.html).toContain("data:image/png;base64,AAAA");
  });

  it("removes Obsidian list helpers and empty list items", () => {
    const result = sanitizeWechatHtml(
      '<ul class="has-list-bullet"><li><div class="list-bullet"><span></span></div>项目一</li><li><br></li><li><div class="list-collapse-indicator"></div>项目二</li></ul>'
    );
    expect(result.html).not.toMatch(/list-bullet|list-collapse-indicator|<li><br><\/li>/);
    expect(result.html.match(/<li>/g)).toHaveLength(2);
    expect(result.html).toContain("<li>项目一</li>");
    expect(result.html).toContain("<li>项目二</li>");
  });

  it("unwraps Obsidian blocks so reference sibling selectors can match", () => {
    const container = document.createElement("div");
    container.innerHTML = '<div class="el-hr"><hr></div><div class="el-p"><p><strong>参考资料：</strong></p></div><div class="el-ol"><ol><li><div class="list-bullet"></div></li><li><div class="list-bullet"></div>有效来源</li><li><br></li></ol></div>';
    normalizeObsidianRenderedDom(container);
    expect(container.innerHTML).toBe("<hr><p><strong>参考资料：</strong></p><ol><li>有效来源</li></ol>");

    const result = inlineArticleCss(container.innerHTML, ".wechat-article hr + p + ol { color: #888888; font-size: 14px; }");
    expect(result.html).toMatch(/<ol style="[^"]*color:\s*#888888/i);
  });
});
