import { App, Component, MarkdownRenderer, normalizePath } from "obsidian";
import { inlineArticleCss, referencedCssVariables } from "./core/css-inliner";
import { normalizeObsidianRenderedDom } from "./core/obsidian-render-normalizer";
import { prepareMarkdown, renderMarkdownSource } from "./core/source-renderer";
import { sanitizeWechatHtml } from "./core/wechat-sanitizer";
import { ImageService } from "./image-service";
import type { ArticleMetadata, RenderedArticle } from "./types";

async function nextPaint(): Promise<void> {
  await new Promise<void>((resolve) => activeWindow.requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => activeWindow.requestAnimationFrame(() => resolve()));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function rasterizeSvg(svg: SVGElement): Promise<string> {
  const serialized = new XMLSerializer().serializeToString(svg);
  const runtimeWindow = activeWindow as unknown as typeof globalThis;
  const url = runtimeWindow.URL.createObjectURL(new Blob([serialized], { type: "image/svg+xml" }));
  try {
    const image = new runtimeWindow.Image();
    image.src = url;
    await image.decode();
    const viewBox = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
    const width = Math.max(1, Math.ceil(svg.getBoundingClientRect().width || viewBox?.[2] || 800));
    const height = Math.max(1, Math.ceil(svg.getBoundingClientRect().height || viewBox?.[3] || 300));
    const scale = Math.min(2, 1600 / width);
    const canvas = activeDocument.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法创建画布");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (value: Blob | null) => value ? resolve(value) : reject(new Error("SVG 转 PNG 失败")),
      "image/png"
    ));
    return await blobToDataUrl(blob);
  } finally {
    runtimeWindow.URL.revokeObjectURL(url);
  }
}

async function convertGraphics(container: HTMLElement): Promise<string[]> {
  const warnings: string[] = [];
  const graphics = Array.from(container.querySelectorAll<SVGElement>(".mermaid svg, mjx-container svg, .math svg"));
  for (const svg of graphics) {
    if (!svg.isConnected) continue;
    try {
      const image = activeDocument.createElement("img");
      image.src = await rasterizeSvg(svg);
      image.alt = svg.closest(".mermaid") ? "Mermaid diagram" : "Math formula";
      image.setAttribute("style", "display:block;max-width:100%;height:auto;margin:1em auto;");
      const target = svg.closest("mjx-container, .mermaid") ?? svg;
      target.replaceWith(image);
    } catch (error) {
      warnings.push(`公式或 Mermaid 转图片失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (container.querySelector("canvas, iframe, video, audio")) warnings.push("动态媒体无法等价上传，已在微信正文中移除或降级。");
  return warnings;
}

export class ArticleRenderService {
  private readonly images: ImageService;

  constructor(private readonly app: App, private readonly owner: Component) {
    this.images = new ImageService(app);
  }

  async render(markdown: string, sourcePath: string, metadata: ArticleMetadata, configuredCssPath: string): Promise<RenderedArticle> {
    const prepared = prepareMarkdown(markdown, metadata.useFirstH1AsTitle);
    const headingWarnings = metadata.useFirstH1AsTitle && !prepared.firstH1
      ? ["已启用首个一级标题作为文章标题，但正文中没有找到 # 标题。"]
      : [];
    if (metadata.mode === "source") {
      return {
        html: renderMarkdownSource(markdown, metadata.useFirstH1AsTitle),
        metadata,
        warnings: [...headingWarnings, "Markdown 会按无格式纯文本显示，微信不会解析 Markdown 语法。"],
        sourcePath
      };
    }

    const container = activeDocument.createElement("div");
    container.addClass("wechat-draft-render-host");
    container.style.position = "fixed";
    container.style.left = "-100000px";
    container.style.width = "677px";
    activeDocument.body.appendChild(container);
    try {
      await MarkdownRenderer.render(this.app, prepared.body, container, sourcePath, this.owner);
      await nextPaint();
      normalizeObsidianRenderedDom(container);
      const warnings = [...headingWarnings, ...await convertGraphics(container)];
      const cssPath = metadata.theme !== "default" ? metadata.theme : configuredCssPath;
      const customCss = await this.readCss(cssPath);
      if (cssPath && !customCss) warnings.push(`找不到自定义 CSS：${cssPath}，已使用默认主题。`);
      if (cssPath && customCss) warnings.push(`已加载自定义 CSS：${cssPath}（${customCss.length} 个字符）。`);
      const computedStyle = activeWindow.getComputedStyle(container);
      const cssVariables = Object.fromEntries(referencedCssVariables(customCss).map((name) =>
        [name, computedStyle.getPropertyValue(name).trim()]
      ).filter((entry) => Boolean(entry[1])));
      const themeClass = activeDocument.body.classList.contains("theme-dark") ? "theme-dark" : "theme-light";
      const inlined = inlineArticleCss(container.innerHTML, customCss, { cssVariables, themeClass });
      warnings.push(...inlined.warnings);
      const embedded = await this.images.embedImages(inlined.html, sourcePath);
      warnings.push(...embedded.warnings);
      const sanitized = sanitizeWechatHtml(embedded.html);
      warnings.push(...sanitized.warnings);
      return { html: sanitized.html, metadata, warnings: [...new Set(warnings)], sourcePath };
    } finally {
      container.remove();
    }
  }

  private async readCss(path: string): Promise<string> {
    if (!path) return "";
    const normalized = normalizePath(path.trim()).replace(/^\/+/, "");
    if (!normalized.toLowerCase().endsWith(".css") || normalized.split("/").includes("..")) return "";
    try {
      if (!await this.app.vault.adapter.exists(normalized)) return "";
      return await this.app.vault.adapter.read(normalized);
    } catch {
      return "";
    }
  }
}
