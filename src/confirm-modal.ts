import { App, Modal, Setting } from "obsidian";

export type DraftAction = "create" | "update";

export class ConfirmDraftModal extends Modal {
  constructor(
    app: App,
    private readonly title: string,
    private readonly action: DraftAction,
    private readonly mediaId: string,
    private readonly onConfirm: () => Promise<void>
  ) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.empty();
    const updating = this.action === "update";
    this.contentEl.createEl("h2", { text: updating ? "确认更新公众号草稿" : "确认创建公众号草稿" });
    this.contentEl.createEl("p", {
      text: updating
        ? `将用文章《${this.title}》覆盖已关联草稿（ID：${this.mediaId}）的第一篇文章。公众号后台对该草稿的手工修改也会被覆盖。不会正式发布或群发。`
        : `将向微信公众号发送文章《${this.title}》的正文、封面和图片，并在草稿箱创建一条新草稿。成功后会将草稿 ID 写入笔记 frontmatter。不会正式发布或群发。`
    });
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("取消").onClick(() => this.close()))
      .addButton((button) => button.setCta().setButtonText(updating ? "更新已有草稿" : "创建新草稿").onClick(async () => {
        button.setDisabled(true);
        this.close();
        await this.onConfirm();
      }));
  }
}
