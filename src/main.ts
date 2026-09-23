import { MarkdownView, Notice, Plugin, TFile, normalizePath, requestUrl } from "obsidian";
import { draftBindingFromFrontmatter, metadataFromFrontmatter } from "./core/frontmatter";
import { escapeHtml } from "./core/source-renderer";
import { prepareMarkdown } from "./core/source-renderer";
import { sanitizeWechatHtml } from "./core/wechat-sanitizer";
import { ImageService, optimizeImage } from "./image-service";
import { ArticleRenderService } from "./render-service";
import { DEFAULT_SETTINGS, WeChatDraftBridgeSettingTab } from "./settings";
import type { ArticleMetadata, PublishResult, RenderedArticle, WeChatDraftBinding, WeChatDraftBridgeSettings } from "./types";
import { validateArticle } from "./validation";
import { WeChatApiClient, WeChatApiError } from "./wechat/api";
import { PublishWorkbenchView, WORKBENCH_VIEW_TYPE } from "./workbench-view";

interface ActiveNoteContext {
  file: TFile;
  markdown: string;
  metadata: ArticleMetadata;
  baseTitle: string;
  draftBinding: WeChatDraftBinding | null;
}

export default class WeChatDraftBridgePlugin extends Plugin {
  settings: WeChatDraftBridgeSettings = { ...DEFAULT_SETTINGS };
  private renderer!: ArticleRenderService;
  private images!: ImageService;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.renderer = new ArticleRenderService(this.app, this);
    this.images = new ImageService(this.app);
    this.registerView(WORKBENCH_VIEW_TYPE, (leaf) => new PublishWorkbenchView(leaf, this));
    this.addRibbonIcon("send", "打开微信草稿桥", () => void this.openWorkbench());
    this.addCommand({ id: "open-publish-workbench", name: "打开公众号草稿工作台", callback: () => void this.openWorkbench() });
    this.addCommand({ id: "test-account-capability", name: "检测公众号草稿接口权限", callback: () => void this.testAccountCapability() });
    this.addCommand({ id: "copy-wechat-rich-text", name: "复制当前笔记为公众号富文本", callback: () => void this.copyActiveArticle() });
    this.addCommand({ id: "export-wechat-html", name: "导出当前笔记为公众号 HTML", callback: () => void this.exportActiveArticle() });
    this.addSettingTab(new WeChatDraftBridgeSettingTab(this.app, this));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(WORKBENCH_VIEW_TYPE);
  }

  async openWorkbench(): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false) ?? undefined;
      await leaf?.setViewState({ type: WORKBENCH_VIEW_TYPE, active: true });
    }
    if (leaf) await this.app.workspace.revealLeaf(leaf);
  }

  async getActiveNoteContext(): Promise<ActiveNoteContext | null> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = view?.file ?? this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") return null;
    const markdown = view?.file?.path === file.path ? view.editor.getValue() : await this.app.vault.cachedRead(file);
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
    const metadata = metadataFromFrontmatter(frontmatter, file.basename, this.settings);
    const baseTitle = metadata.title;
    if (metadata.useFirstH1AsTitle) metadata.title = prepareMarkdown(markdown).firstH1 || baseTitle;
    const draftBinding = draftBindingFromFrontmatter(frontmatter);
    return { file, markdown, metadata, baseTitle, draftBinding };
  }

  async renderArticle(markdown: string, sourcePath: string, metadata: ArticleMetadata): Promise<RenderedArticle> {
    return await this.renderer.render(markdown, sourcePath, metadata, this.settings.customCssPath);
  }

  async publishArticle(article: RenderedArticle, draftBinding: WeChatDraftBinding | null = null): Promise<PublishResult> {
    const errors = validateArticle(article);
    if (errors.length) throw new Error(errors.join(" "));
    const client = this.createClient();
    if (draftBinding) {
      const appId = this.settings.appId.trim();
      if (draftBinding.account && draftBinding.account !== appId) {
        throw new Error("这篇笔记关联的草稿属于另一个公众号。请切换到原账号，或选择“另存为新草稿”。");
      }
      await client.getDraftArticle(draftBinding.mediaId, draftBinding.articleIndex);
    }
    const uploaded = await this.images.uploadContentImages(article.html, article.sourcePath, (asset) => client.uploadContentImage(asset));
    if (uploaded.warnings.length) throw new Error(`正文图片上传未全部成功，已停止创建草稿：${uploaded.warnings.join("；")}`);

    let cover = uploaded.firstAsset;
    if (article.metadata.cover) cover = await this.images.resolveAsset(article.metadata.cover, article.sourcePath, "cover");
    if (!cover) throw new Error("缺少封面。源码模式必须设置封面；排版模式可使用正文第一张图片。");
    const optimizedCover = await optimizeImage(cover, 64 * 1024, true);
    const coverMediaId = await client.uploadCover(optimizedCover);
    const finalHtml = sanitizeWechatHtml(uploaded.html);
    if (finalHtml.warnings.length) throw new Error(`上传前清理发现问题：${finalHtml.warnings.join("；")}`);
    return draftBinding
      ? await client.updateDraft(draftBinding.mediaId, draftBinding.articleIndex, article.metadata, finalHtml.html, coverMediaId)
      : await client.createDraft(article.metadata, finalHtml.html, coverMediaId);
  }

  async saveDraftBinding(sourcePath: string, mediaId: string, articleIndex = 0): Promise<WeChatDraftBinding> {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) throw new Error("草稿已上传，但无法找到原笔记来保存草稿 ID。");
    const binding: WeChatDraftBinding = {
      mediaId,
      account: this.settings.appId.trim(),
      articleIndex,
      updatedAt: new Date().toISOString()
    };
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter["wechat-draft"] = {
        "media-id": binding.mediaId,
        account: binding.account,
        "article-index": binding.articleIndex,
        "updated-at": binding.updatedAt
      };
      delete frontmatter["wechat-draft-id"];
    });
    return binding;
  }

  async copyArticle(article: RenderedArticle): Promise<void> {
    const htmlBlob = new Blob([article.html], { type: "text/html" });
    try {
      const holder = activeDocument.createElement("div");
      const parsed = new DOMParser().parseFromString(`<body>${article.html}</body>`, "text/html");
      holder.append(...Array.from(parsed.body.childNodes).map((node) => activeDocument.importNode(node, true)));
      const item = new ClipboardItem({ "text/html": htmlBlob, "text/plain": new Blob([holder.innerText], { type: "text/plain" }) });
      await activeWindow.navigator.clipboard.write([item]);
    } catch {
      await activeWindow.navigator.clipboard.writeText(article.html);
      new Notice("当前环境不支持富文本剪贴板，已复制 HTML 源码。");
      return;
    }
    new Notice("已复制公众号富文本");
  }

  async exportArticle(article: RenderedArticle): Promise<void> {
    const source = this.app.vault.getAbstractFileByPath(article.sourcePath);
    const parent = source instanceof TFile ? source.parent?.path ?? "" : "";
    const base = source instanceof TFile ? source.basename : "wechat-article";
    let index = 0;
    let path = "";
    do {
      const suffix = index ? `-${index}` : "";
      path = normalizePath(`${parent}/${base}${suffix}.wechat.html`);
      index++;
    } while (this.app.vault.getAbstractFileByPath(path));
    const document = `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(article.metadata.title)}</title></head><body>${article.html}</body></html>`;
    await this.app.vault.create(path, document);
    new Notice(`已导出 ${path}`);
  }

  async testAccountCapability(): Promise<void> {
    try {
      const count = await this.createClient().testCapability();
      new Notice(`连接成功，当前草稿数量：${count}`);
    } catch (error) {
      new Notice(this.describeError(error), 10_000);
    }
  }

  describeError(error: unknown): string {
    if (error instanceof WeChatApiError) return error.message;
    return `操作失败：${error instanceof Error ? error.message : String(error)}`;
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async loadSettings(): Promise<void> {
    const loaded = await this.loadData() as Partial<WeChatDraftBridgeSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(loaded ?? {}) };
  }

  private createClient(): WeChatApiClient {
    const appId = this.settings.appId.trim();
    const secret = this.app.secretStorage.getSecret(this.settings.appSecretKey);
    if (!appId) throw new Error("请先在设置中填写公众号 AppID。");
    if (!secret) throw new Error("请先在 SecretStorage 中选择或创建 AppSecret。");
    return new WeChatApiClient(appId, secret, requestUrl);
  }

  private async copyActiveArticle(): Promise<void> {
    const article = await this.renderCurrent();
    if (article) await this.copyArticle(article);
  }

  private async exportActiveArticle(): Promise<void> {
    const article = await this.renderCurrent();
    if (article) await this.exportArticle(article);
  }

  private async renderCurrent(): Promise<RenderedArticle | null> {
    const context = await this.getActiveNoteContext();
    if (!context) {
      new Notice("请先打开一篇 Markdown 笔记");
      return null;
    }
    return await this.renderArticle(context.markdown, context.file.path, context.metadata);
  }
}
