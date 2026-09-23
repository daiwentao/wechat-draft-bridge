import { App, Notice, PluginSettingTab, SecretComponent, Setting, normalizePath } from "obsidian";
import type WeChatDraftBridgePlugin from "./main";
import type { WeChatDraftBridgeSettings } from "./types";

export const DEFAULT_SETTINGS: WeChatDraftBridgeSettings = {
  appId: "",
  appSecretKey: "wechat-draft-bridge-app-secret",
  defaultAuthor: "",
  defaultCover: "",
  defaultMode: "styled",
  defaultUseFirstH1AsTitle: false,
  customCssPath: ""
};

export class WeChatDraftBridgeSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: WeChatDraftBridgePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "微信草稿桥" });
    containerEl.createEl("p", { text: "只有检测账号、上传素材或创建草稿时才会连接微信接口。正文与图片不会发送给插件作者。" });

    new Setting(containerEl).setName("公众号 AppID").addText((text) => text
      .setPlaceholder("wx…")
      .setValue(this.plugin.settings.appId)
      .onChange(async (value) => {
        this.plugin.settings.appId = value.trim();
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("公众号 AppSecret")
      .setDesc("凭证保存到 Obsidian SecretStorage；插件 data.json 只保存引用名称。")
      .addComponent((element) => new SecretComponent(this.app, element)
        .setValue(this.plugin.settings.appSecretKey)
        .onChange(async (value) => {
          this.plugin.settings.appSecretKey = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl).setName("默认作者").addText((text) => text
      .setValue(this.plugin.settings.defaultAuthor)
      .onChange(async (value) => {
        this.plugin.settings.defaultAuthor = value.trim();
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("默认封面")
      .setDesc("填写 Vault 内图片路径或 https 图片地址；留空时排版模式使用正文第一张图片。")
      .addText((text) => text.setValue(this.plugin.settings.defaultCover).onChange(async (value) => {
        this.plugin.settings.defaultCover = value.trim();
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl).setName("默认正文模式").addDropdown((dropdown) => dropdown
      .addOptions({ styled: "CSS 排版", source: "Markdown 纯文本（无格式）" })
      .setValue(this.plugin.settings.defaultMode)
      .onChange(async (value) => {
        this.plugin.settings.defaultMode = value === "source" ? "source" : "styled";
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("默认使用首个一级标题")
      .setDesc("启用后，将笔记中的第一个 # 标题作为公众号标题，并从正文移除。可在草稿工作台中逐篇调整。")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.defaultUseFirstH1AsTitle)
        .onChange(async (value) => {
          this.plugin.settings.defaultUseFirstH1AsTitle = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("自定义 CSS 文件")
      .setDesc("Vault 内的 .css 文件路径。wechat-theme frontmatter 可为单篇文章覆盖此路径。")
      .addText((text) => text.setPlaceholder("Themes/wechat.css").setValue(this.plugin.settings.customCssPath).onChange(async (value) => {
        this.plugin.settings.customCssPath = value.trim();
        await this.plugin.saveSettings();
      }))
      .addButton((button) => button.setButtonText("检测文件").onClick(async () => {
        const path = normalizePath(this.plugin.settings.customCssPath.trim()).replace(/^\/+/, "");
        if (!path || !path.toLowerCase().endsWith(".css") || path.split("/").includes("..")) {
          new Notice("请输入 Vault 内有效的 .css 相对路径。", 8_000);
          return;
        }
        try {
          if (!await this.app.vault.adapter.exists(path)) {
            new Notice(`未找到 CSS 文件：${path}`, 8_000);
            return;
          }
          const css = await this.app.vault.adapter.read(path);
          new Notice(`已读取 CSS：${path}（${css.length} 个字符）。请回到工作台刷新预览。`, 8_000);
        } catch (error) {
          new Notice(`CSS 读取失败：${error instanceof Error ? error.message : String(error)}`, 8_000);
        }
      }));

    new Setting(containerEl).setName("检测账号能力").setDesc("读取草稿数量，不创建或修改草稿。")
      .addButton((button) => button.setButtonText("开始检测").onClick(() => void this.plugin.testAccountCapability()));
  }
}
