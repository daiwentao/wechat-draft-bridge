<div align="center">

# 微信草稿桥（WeChat Draft Bridge）

> Obsidian → 微信公众号草稿箱

在 Obsidian 中排版、预览，并将当前笔记创建或更新到微信公众号草稿箱。

![Version](https://img.shields.io/badge/version-0.3.0-576b95)
![Obsidian](https://img.shields.io/badge/Obsidian-%E2%89%A51.11.4-7c3aed)
![Platform](https://img.shields.io/badge/platform-desktop-4b5563)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

[简体中文](README.md) · [English](README.en.md)

> [!IMPORTANT]
> 本插件只创建或更新草稿，不会正式发布、群发消息，也不会调用 `freepublish` 接口。

## 为什么做这个插件

在 Obsidian 里写完文章后，复制到微信公众号通常还要重新调整标题、颜色、引用、列表和图片。微信草稿桥将这些操作放在一个草稿工作台中：

1. 读取当前 Markdown 笔记。
2. 按指定 CSS 进行排版并生成微信兼容预览。
3. 上传正文图片和封面。
4. 创建草稿，或继续更新同一篇草稿。
5. 接口不可用时，仍可复制富文本或导出 HTML。

## 主要功能

- **CSS 排版**：使用 Obsidian 渲染 Markdown，加载内置主题或 Vault 内自定义 CSS，再转换成微信可接收的内联样式。
- **Markdown 纯文本**：类似 `Ctrl+Shift+V` 的无格式粘贴，保留换行、空行、缩进和连续空格。
- **微信兼容预览**：上传前检查排版结果和兼容性问题。
- **图片处理**：支持 Vault 图片、Wiki 图片、data URL 和 HTTPS 图片。
- **标题提取**：可将第一个 `#` 一级标题作为公众号标题，并从正文移除。
- **草稿绑定**：首次创建后自动记录草稿 ID，后续默认更新原草稿。
- **安全降级**：支持复制公众号富文本和导出独立 HTML。
- **本地优先**：不使用作者中转服务，不收集遥测数据。

## 使用条件

- Obsidian `1.11.4` 或更高版本。
- Windows、macOS 或 Linux 桌面端。
- 微信公众号 AppID 与 AppSecret。
- 当前公网出口 IP 已加入公众号 API IP 白名单。
- 公众号拥有素材和草稿接口权限。

> 部分未认证个人号可能返回 `48001`，表示当前账号没有对应接口权限。这无法通过更换 IP 解决，但仍可使用“复制富文本”手动粘贴到公众号编辑器。

## 安装

### 使用 BRAT（推荐）

[BRAT](https://github.com/TfTHacker/obsidian42-brat) 可从 GitHub Release 安装未进入 Obsidian 社区目录的插件，并帮助检查更新。

1. 打开 Obsidian“设置 → 第三方插件 → 社区插件市场”。
2. 搜索 **BRAT**，安装并启用 **Obsidian42 - BRAT**。
3. 打开命令面板（`Ctrl/Cmd + P`）。
4. 运行 `BRAT: Add a beta plugin for testing`。
5. 粘贴本项目的 GitHub 仓库地址：

   ```text
   https://github.com/daiwentao/wechat-draft-bridge
   ```

6. 选择跟踪最新 Release，等待 BRAT 提示安装成功。
7. 回到“设置 → 第三方插件”，启用 **WeChat Draft Bridge**。

以后可在 BRAT 设置中检查更新，或运行 `BRAT: Check for updates to all beta plugins and UPDATE`。BRAT 安装需要仓库已发布对应版本的 GitHub Release，且 Release 包含 `main.js`、`manifest.json` 和 `styles.css`。

### 手动安装

1. 从 GitHub Releases 下载最新 ZIP。
2. 在 Vault 中创建目录：

   ```text
   <Vault>/.obsidian/plugins/wechat-draft-bridge/
   ```

3. 将 ZIP 中的三个文件解压到该目录：

   ```text
   main.js
   manifest.json
   styles.css
   ```

4. 重新加载 Obsidian，在“设置 → 第三方插件”中启用 **WeChat Draft Bridge**。

## 快速开始

1. 打开“设置 → 第三方插件 → WeChat Draft Bridge”。
2. 填写公众号 AppID。
3. 通过 Obsidian SecretStorage 选择或创建 AppSecret。
4. 将当前出口 IP 加入公众号白名单。
5. 运行“检测公众号草稿接口权限”。
6. 打开 Markdown 笔记，点击左侧发送图标，或运行“打开公众号草稿工作台”。
7. 检查标题、封面、预览和问题清单，再确认创建草稿。

## 获取和配置公众号 AppID、AppSecret

### 1. 进入公众号开发配置

1. 打开[微信公众平台](https://mp.weixin.qq.com/)，使用公众号管理员账号登录。
2. 在左侧菜单进入“设置与开发 → 基本配置”。部分新版后台显示为“设置与开发 → 开发接口管理 → 基本配置”。
3. 找到“公众号开发信息”。

请确认登录的是**微信公众平台中的公众号**，不是微信开放平台的移动应用，也不是小程序后台。

### 2. 获取 AppID

复制“开发者 ID (AppID)”，通常以 `wx` 开头。在 Obsidian 中打开：

```text
设置 → 第三方插件 → WeChat Draft Bridge → 公众号 AppID
```

将 AppID 完整粘贴到输入框，不要填公众号微信号、原始 ID 或小程序 AppID。

### 3. 生成或重置 AppSecret

1. 在“开发者密码 (AppSecret)”旁边点击“启用”、“查看”或“重置”，具体按钮名称可能因账号状态不同而不同。
2. 按微信公众平台的提示完成管理员身份验证。
3. 立即复制新的 AppSecret。公众平台通常不会一直明文显示它，丢失后只能重置。

> [!WARNING]
> AppSecret 相当于公众号的高权限密码。不要把它写入笔记、CSS、frontmatter、Issue、截图或 GitHub 仓库。重置 AppSecret 后，旧值会失效，需要在插件中重新配置。

### 4. 将 AppSecret 保存到 Obsidian SecretStorage

1. 打开“设置 → 第三方插件 → WeChat Draft Bridge”。
2. 在“公众号 AppSecret”一行点击“链接…”。
3. 在 Obsidian SecretStorage 中新建一个凭证，名称可使用 `wechat-draft-bridge-app-secret`，值填入刚才复制的 AppSecret。
4. 选中该凭证，让插件与它建立关联。

插件的 `data.json` 只保存 SecretStorage 引用名，不保存 AppSecret 明文。

### 5. 设置 IP 白名单

1. 在**实际运行 Obsidian 和本插件的设备**上打开 [https://api.ipify.org/](https://api.ipify.org/)。
2. 复制页面显示的公网出口 IP。
3. 回到微信公众平台的“基本配置”，找到“IP 白名单”，点击“配置”或“查看”。
4. 将 IP 加入白名单并保存，根据要求完成管理员验证。

如果你开启了 VPN、代理或公司网关，应填写当时的**实际出口 IP**。家庭宽带、手机热点和部分代理的 IP 可能变化；再次出现 `40164` 时，需要查询新 IP 并更新白名单。

### 6. 检测配置

回到插件设置，点击“检测账号能力 → 开始检测”。该操作只读取草稿数量，不会创建、更新或删除草稿。

- `40164`：当前出口 IP 不在白名单。
- `40013`：AppID 无效，请检查是否使用了正确的公众号 AppID。
- `40125`：AppSecret 无效或已重置。
- `48001`：当前公众号没有草稿接口权限。

本插件不接收微信服务器的回调消息，因此**不需要**为它配置服务器 URL、Token、EncodingAESKey、业务域名、JS 接口安全域名或网页授权域名。

## 两种正文模式

### CSS 排版

插件调用 Obsidian Markdown 渲染器，再应用自定义 CSS。上传前会将 CSS 转换为元素的内联 `style`，因为微信编辑器不会保留完整样式表。

支持标题、段落、列表、引用、Callout、代码块、表格和图片等内容。伪元素、复杂动画、外部字体和部分现代 CSS 特性无法在微信中可靠保留。

### Markdown 纯文本

不解析 Markdown 格式。`#`、`**`、代码围栏等字符作为普通文字保留，同时保留空行、缩进和连续空格。该模式不解析图片引用，需要单独设置封面。

## 自定义 CSS

在插件设置中填写 Vault 内 CSS 相对路径，例如 `Themes/wechat.css`。推荐使用 `.wechat-article` 作为根容器：

```css
.wechat-article {
  color: #595959;
  font-size: 17px;
  line-height: 1.8;
}

.wechat-article h2 {
  color: #ff6600;
}

.wechat-article blockquote {
  margin: 1em 0;
  padding-left: 1em;
  border-left: 4px solid #ff6600;
  color: #777;
}
```

渲染容器同时提供 `.markdown-here-wrapper`、`.markdown-preview-view` 和 `.markdown-rendered` 类，便于复用 Markdown Here 或 Obsidian 预览样式。

## Frontmatter

所有草稿字段均为可选：

```yaml
---
wechat-title: 文章标题
wechat-author: 作者
wechat-digest: 摘要
wechat-cover: Assets/cover.jpg
wechat-source-url: https://example.com/original
wechat-mode: styled # styled 或 source
wechat-theme: Themes/wechat.css
wechat-use-first-h1-as-title: true
---
```

首次创建草稿成功后，插件会自动加入：

```yaml
wechat-draft:
  media-id: "微信返回的草稿 ID"
  account: "当前公众号 AppID"
  article-index: 0
  updated-at: "2026-09-23T08:00:00.000Z"
```

后续打开该笔记时，按钮会变为“更新已有草稿”。如果希望保留旧草稿，请选择“另存为新草稿”。

> 复制笔记时也会复制 `wechat-draft`。如果副本不应覆盖原草稿，请删除该字段，或选择“另存为新草稿”。

## 安全与隐私

- AppSecret 使用 Obsidian SecretStorage 保存，不写入笔记或插件 `data.json`。
- access token 只在内存中缓存，不写入日志或导出文件。
- 只有用户确认创建或更新草稿后，文章和图片才会发送到 `api.weixin.qq.com`。
- 不包含遥测、广告、作者中转服务、自动正式发布或自更新功能。
- 草稿关联信息不包含 AppSecret 或 token。

Obsidian 第三方插件运行在同一应用进程中。SecretStorage 比明文 `data.json` 更安全，但不是隔离其他恶意插件的绝对安全边界。

## 常见问题

### 为什么提示 `40164`？

当前出口 IP 不在微信公众号 API 白名单中。部分宽带出口 IP 会变化，变化后需要重新添加。

### 为什么提示 `48001`？

当前公众号没有该接口权限。这与 IP 白名单无关，无法通过固定 IP 代理解决，请改用“复制富文本”。

### 同一篇文章重复上传会怎样？

笔记中存在 `wechat-draft` 时默认更新原草稿；没有时创建新草稿。你始终可以选择“另存为新草稿”。

### 为什么 CSS 在 Obsidian 中有效，上传后却不一样？

微信会清理部分 HTML 标签和 CSS 属性。插件只能在微信支持的范围内尽量还原，不能保证像素级一致。建议避免伪元素、CSS 变量、动画和复杂布局。

## 开发

```bash
npm install
npm run verify
```

生产构建：

```bash
npm run build
```

请勿向 GitHub 提交 AppSecret、access token、`.env`、私钥、证书或其他真实凭证。`npm run security` 会扫描常见的意外泄漏。

## 请作者喝杯咖啡

如果你喜欢这个插件，且觉得对你有用，可以请我喝杯咖啡支持一下，谢谢！

| 微信 | 支付宝 |
|:---:|:---:|
| <img src="./assets/donate-wechat.jpg" width="200" alt="微信支付赞赏码" /> | <img src="./assets/donate-alipay.jpg" width="200" alt="支付宝赞赏码" /> |

## 贡献

欢迎提交 Issue 和 Pull Request。报告问题时，请提供 Obsidian 版本、操作系统、插件版本、脱敏后的错误码以及可复现问题的最小 Markdown 片段。

请勿在 Issue、日志或截图中公开 AppSecret 和 access token。

## 免责声明

本项目是社区开源工具，与 Obsidian 官方及腾讯微信团队无关。微信公众号的接口权限、内容规范和页面兼容性可能变化，请以微信公众平台当前规则为准。

## 许可证

[MIT License](LICENSE)
