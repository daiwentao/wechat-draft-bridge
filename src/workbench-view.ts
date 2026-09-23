import { ItemView, Notice, Setting, WorkspaceLeaf } from "obsidian";
import type WeChatDraftBridgePlugin from "./main";
import { ConfirmDraftModal, type DraftAction } from "./confirm-modal";
import type { ArticleMetadata, RenderedArticle, WeChatDraftBinding } from "./types";
import { validateArticle } from "./validation";
import { prepareMarkdown } from "./core/source-renderer";

export const WORKBENCH_VIEW_TYPE = "wechat-draft-bridge-workbench";

export class PublishWorkbenchView extends ItemView {
  private article: RenderedArticle | null = null;
  private loadedPath = "";
  private baseTitle = "";
  private form: ArticleMetadata | null = null;
  private noteMetadata: ArticleMetadata | null = null;
  private draftBinding: WeChatDraftBinding | null = null;
  private readonly dirtyFields = new Set<keyof ArticleMetadata>();
  private refreshSequence = 0;
  private formEl!: HTMLElement;
  private issueEl!: HTMLElement;
  private previewEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private publishButton!: HTMLButtonElement;
  private createNewButton!: HTMLButtonElement;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: WeChatDraftBridgePlugin) {
    super(leaf);
  }

  getViewType(): string { return WORKBENCH_VIEW_TYPE; }
  getDisplayText(): string { return "微信草稿桥"; }
  getIcon(): string { return "send"; }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("wechat-draft-workbench");
    const toolbar = container.createDiv({ cls: "wechat-draft-toolbar" });
    toolbar.createEl("h2", { text: "微信草稿桥" });
    const actions = toolbar.createDiv({ cls: "wechat-draft-actions" });
    actions.createEl("button", { text: "刷新预览" }).addEventListener("click", () => void this.refresh());
    actions.createEl("button", { text: "复制富文本" }).addEventListener("click", () => void this.copy());
    actions.createEl("button", { text: "导出 HTML" }).addEventListener("click", () => void this.exportHtml());
    this.createNewButton = actions.createEl("button", { text: "另存为新草稿" });
    this.createNewButton.addEventListener("click", () => this.confirmPublish("create"));
    this.publishButton = actions.createEl("button", { text: "创建草稿", cls: "mod-cta" });
    this.publishButton.addEventListener("click", () => this.confirmPublish(this.draftBinding ? "update" : "create"));
    this.updatePublishActions();
    this.statusEl = container.createDiv({ cls: "wechat-draft-status" });
    this.formEl = container.createDiv({ cls: "wechat-draft-form" });
    this.issueEl = container.createDiv({ cls: "wechat-draft-issues" });
    this.previewEl = container.createDiv({ cls: "wechat-draft-preview" });
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const sequence = ++this.refreshSequence;
    this.setStatus("正在渲染…");
    try {
      const context = await this.plugin.getActiveNoteContext();
      if (sequence !== this.refreshSequence) return;
      if (!context) {
        this.setStatus("请先打开一篇 Markdown 笔记。");
        return;
      }
      const bindingChanged = JSON.stringify(this.draftBinding) !== JSON.stringify(context.draftBinding);
      this.draftBinding = context.draftBinding;
      this.updatePublishActions();
      if (context.file.path !== this.loadedPath || !this.form) {
        this.loadedPath = context.file.path;
        this.baseTitle = context.baseTitle;
        this.form = { ...context.metadata };
        this.noteMetadata = { ...context.metadata };
        this.dirtyFields.clear();
        this.renderForm();
      } else {
        let formChanged = false;
        for (const key of Object.keys(context.metadata) as Array<keyof ArticleMetadata>) {
          if (context.metadata[key] !== this.noteMetadata?.[key] && !this.dirtyFields.has(key)) {
            Object.assign(this.form, { [key]: context.metadata[key] });
            formChanged = true;
          }
        }
        this.noteMetadata = { ...context.metadata };
        this.baseTitle = context.baseTitle;
        if (this.form.useFirstH1AsTitle) {
          const title = prepareMarkdown(context.markdown).firstH1 || this.baseTitle;
          if (title !== this.form.title) {
            this.form.title = title;
            formChanged = true;
          }
        }
        if (formChanged || bindingChanged) this.renderForm();
      }
      const article = await this.plugin.renderArticle(context.markdown, context.file.path, { ...this.form });
      if (sequence !== this.refreshSequence) return;
      this.article = article;
      this.renderIssues();
      this.renderPreview();
      this.setStatus(`已渲染：${context.file.path}`);
    } catch (error) {
      if (sequence !== this.refreshSequence) return;
      this.setStatus(`渲染失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private renderForm(): void {
    if (!this.form) return;
    const form = this.form;
    this.formEl.empty();
    new Setting(this.formEl)
      .setName("微信草稿")
      .setDesc(this.draftBinding
        ? `已关联 ${this.draftBinding.mediaId}${this.draftBinding.updatedAt ? `；上次上传 ${this.formatTimestamp(this.draftBinding.updatedAt)}` : ""}`
        : "未关联；首次上传将创建新草稿并把 ID 写入 frontmatter。");
    const bindText = (name: string, key: keyof Pick<ArticleMetadata, "title" | "author" | "digest" | "cover" | "sourceUrl" | "theme">, placeholder = "", disabled = false) => {
      new Setting(this.formEl).setName(name).addText((text) => text
        .setPlaceholder(placeholder)
        .setValue(String(this.form?.[key] ?? ""))
        .setDisabled(disabled)
        .onChange((value) => {
          if (this.form) this.form[key] = value.trim();
          this.dirtyFields.add(key);
        }));
    };
    new Setting(this.formEl).setName("正文模式").addDropdown((dropdown) => dropdown
      .addOptions({ styled: "CSS 排版", source: "Markdown 纯文本（无格式）" })
      .setValue(form.mode)
      .onChange(async (value) => {
        if (this.form) this.form.mode = value === "source" ? "source" : "styled";
        this.dirtyFields.add("mode");
        await this.refresh();
      }));
    new Setting(this.formEl)
      .setName("首个一级标题作为文章标题")
      .setDesc("提取第一个 # 标题填入标题栏，并从正文中移除。")
      .addToggle((toggle) => toggle
        .setValue(form.useFirstH1AsTitle)
        .onChange(async (value) => {
          if (!this.form) return;
          this.form.useFirstH1AsTitle = value;
          this.dirtyFields.add("useFirstH1AsTitle");
          const context = await this.plugin.getActiveNoteContext();
          this.baseTitle = context?.baseTitle ?? this.baseTitle;
          this.form.title = value && context ? prepareMarkdown(context.markdown).firstH1 || this.baseTitle : this.baseTitle;
          this.renderForm();
          await this.refresh();
        }));
    bindText("标题", "title", "", form.useFirstH1AsTitle);
    bindText("作者", "author");
    bindText("摘要", "digest");
    bindText("封面", "cover", "Vault 图片路径或 https 地址；可留空使用正文首图");
    bindText("阅读原文", "sourceUrl", "https://…");
    bindText("本篇 CSS", "theme", "default 或 Vault 内 .css 路径");
  }

  private renderIssues(): void {
    this.issueEl.empty();
    if (!this.article) return;
    const errors = validateArticle(this.article);
    const issues = [...errors.map((text) => `错误：${text}`), ...this.article.warnings.map((text) => `提示：${text}`)];
    if (!issues.length) {
      this.issueEl.createEl("p", { text: "未发现阻断问题。", cls: "wechat-draft-ok" });
      return;
    }
    const list = this.issueEl.createEl("ul");
    for (const issue of issues) list.createEl("li", { text: issue });
  }

  private renderPreview(): void {
    this.previewEl.empty();
    if (!this.article) return;
    const host = this.previewEl.createDiv({ cls: "wechat-draft-preview-host" });
    const shadow = host.attachShadow({ mode: "open" });
    const previewStyle = this.previewEl.ownerDocument.createElement("style");
    previewStyle.textContent = `
      :host { display: block; color: #222; background: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
      .preview-root { display: block; box-sizing: border-box; max-width: 100%; }
      img { max-width: 100%; height: auto; }
    `;
    const root = this.previewEl.ownerDocument.createElement("div");
    root.className = "preview-root";
    const parsed = new DOMParser().parseFromString(`<body>${this.article.html}</body>`, "text/html");
    for (const child of Array.from(parsed.body.childNodes)) root.appendChild(this.previewEl.ownerDocument.importNode(child, true));
    shadow.append(previewStyle, root);
  }

  private async copy(): Promise<void> {
    if (!this.article) return void new Notice("请先刷新预览");
    await this.plugin.copyArticle(this.article);
  }

  private async exportHtml(): Promise<void> {
    if (!this.article) return void new Notice("请先刷新预览");
    await this.plugin.exportArticle(this.article);
  }

  private confirmPublish(action: DraftAction): void {
    if (!this.article || !this.form) return void new Notice("请先刷新预览");
    if (action === "update" && !this.draftBinding) return void new Notice("当前笔记没有关联草稿，请先创建新草稿。");
    const article = { ...this.article, metadata: { ...this.form } };
    const errors = validateArticle(article);
    if (errors.length) return void new Notice(errors[0] ?? "文章校验失败");
    const targetBinding = action === "update" ? this.draftBinding : null;
    new ConfirmDraftModal(this.app, article.metadata.title, action, targetBinding?.mediaId ?? "", async () => {
      this.setStatus(action === "update" ? "正在校验已关联草稿并上传更新…" : "正在上传图片并创建草稿…");
      try {
        const result = await this.plugin.publishArticle(article, targetBinding);
        try {
          this.draftBinding = await this.plugin.saveDraftBinding(article.sourcePath, result.mediaId, targetBinding?.articleIndex ?? 0);
          this.updatePublishActions();
          this.renderForm();
        } catch (bindingError) {
          const operation = action === "update" ? "已更新" : "已创建";
          const message = `草稿${operation}（ID：${result.mediaId}），但写入 frontmatter 失败：${bindingError instanceof Error ? bindingError.message : String(bindingError)}。请勿立即重试上传。`;
          this.setStatus(message);
          new Notice(message, 12_000);
          return;
        }
        const suffix = result.verified ? "，回读核验成功" : "，请到公众号后台复核";
        const operation = action === "update" ? "已更新" : "已创建";
        this.setStatus(`草稿${operation}：${result.mediaId}${suffix}`);
        new Notice(`微信公众号草稿${operation}${suffix}`);
      } catch (error) {
        this.setStatus(this.plugin.describeError(error));
        new Notice(this.plugin.describeError(error), 10_000);
      }
    }).open();
  }

  private updatePublishActions(): void {
    if (!this.publishButton || !this.createNewButton) return;
    this.publishButton.setText(this.draftBinding ? "更新已有草稿" : "创建新草稿");
    this.createNewButton.hidden = !this.draftBinding;
  }

  private formatTimestamp(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
  }

  private setStatus(text: string): void {
    this.statusEl?.setText(text);
  }
}
