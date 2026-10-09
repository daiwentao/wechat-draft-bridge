<div align="center">

# WeChat Draft Bridge（微信草稿桥）

> Obsidian → WeChat Official Account Drafts

Preview, style, create, and safely update WeChat Official Account drafts from Obsidian.

![Version](https://img.shields.io/badge/version-0.3.2-576b95)
![Obsidian](https://img.shields.io/badge/Obsidian-%E2%89%A51.11.4-7c3aed)
![Platform](https://img.shields.io/badge/platform-desktop-4b5563)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

[简体中文](README.md) · [English](README.en.md)

> [!IMPORTANT]
> This plugin only creates or updates drafts. It never publishes articles, sends mass messages, or calls WeChat's `freepublish` API.

## Why this plugin

Moving an article from Obsidian into the WeChat Official Account editor often means rebuilding headings, colors, quotes, lists, and images by hand. WeChat Draft Bridge provides one local draft workbench that:

1. Reads the active Markdown note.
2. Renders a WeChat-compatible preview using a built-in or Vault CSS theme.
3. Uploads body images and a cover.
4. Creates a new draft or updates the draft already linked to the note.
5. Falls back to rich-text copy or standalone HTML export when the API is unavailable.

## Features

- **CSS layout mode:** render Markdown through Obsidian, apply custom CSS, and inline supported styles for WeChat.
- **Markdown plain-text mode:** preserve line breaks, blank lines, indentation, and repeated spaces without rich-text formatting.
- **Compatibility preview:** inspect the final layout and warnings before any upload.
- **Image handling:** resolve Vault images, wiki images, data URLs, and HTTPS images.
- **Title extraction:** optionally use the first level-one heading as the WeChat title and remove it from the body.
- **Draft binding:** save the returned draft ID in frontmatter and update the same draft later.
- **Safe fallback:** copy WeChat-ready rich text or export a standalone HTML file.
- **Local first:** no author-operated relay server and no telemetry.

## Requirements

- Obsidian `1.11.4` or newer on Windows, macOS, or Linux desktop.
- A WeChat Official Account AppID and AppSecret.
- Your current public egress IP in the account's API allowlist.
- Permission to call WeChat material and draft APIs.

Some unverified personal accounts return `48001`, which means the account does not have the required API permission. Changing the IP cannot fix an account-level permission restriction; use the rich-text copy fallback instead.

## Installation

### BRAT (recommended before Community Plugins approval)

1. Install and enable [Obsidian42 - BRAT](https://github.com/TfTHacker/obsidian42-brat) from Obsidian's Community Plugins browser.
2. Open the command palette and run `BRAT: Add a beta plugin for testing`.
3. Paste the repository URL:

   ```text
   https://github.com/daiwentao/wechat-draft-bridge
   ```

4. Track the latest release and wait for BRAT to finish installation.
5. Enable **WeChat Draft Bridge** under **Settings → Community plugins**.

Use `BRAT: Check for updates to all beta plugins and UPDATE` for later updates. BRAT requires a matching GitHub Release containing `main.js`, `manifest.json`, and `styles.css`.

### Manual installation

1. Download the latest ZIP from GitHub Releases.
2. Create this directory inside your Vault:

   ```text
   <Vault>/.obsidian/plugins/wechat-draft-bridge/
   ```

3. Extract these files into it:

   ```text
   main.js
   manifest.json
   styles.css
   ```

4. Reload Obsidian and enable **WeChat Draft Bridge** under **Settings → Community plugins**.

## Quick start

1. Open **Settings → Community plugins → WeChat Draft Bridge**.
2. Enter the Official Account AppID.
3. Select or create an AppSecret through Obsidian SecretStorage.
4. Add the current public IP to the Official Account API allowlist.
5. Run **Test Official Account draft API permission**.
6. Open a Markdown note and run **Open Official Account draft workbench**.
7. Review the metadata, cover, preview, and warnings, then confirm draft creation.

## AppID, AppSecret, and IP allowlist

1. Sign in to the [WeChat Official Account Platform](https://mp.weixin.qq.com/).
2. Open **Settings and Development → Basic Configuration**. Some layouts place it under **Development Interface Management → Basic Configuration**.
3. Under the Official Account developer information, copy the **Developer ID (AppID)**. Use the Official Account AppID, not an original account ID, Mini Program AppID, or Open Platform application ID.
4. Enable, reveal, or reset the **Developer Password (AppSecret)** and complete administrator verification. Copy the new value immediately; after a reset, the previous secret stops working.
5. In Obsidian, open **Settings → Community plugins → WeChat Draft Bridge**, enter the AppID, click **Link…** beside AppSecret, create a SecretStorage entry such as `wechat-draft-bridge-app-secret`, and select it.
6. On the device that runs Obsidian, open [https://api.ipify.org/](https://api.ipify.org/) and copy the displayed public egress IP.
7. Add that IP to **Basic Configuration → IP Allowlist** in the WeChat Official Account Platform.
8. Back in the plugin settings, run **Test account capability**. This check only reads the draft count and does not modify any draft.

Common errors:

- `40164`: the current public egress IP is not allowlisted.
- `40013`: the AppID is invalid or belongs to the wrong WeChat product.
- `40125`: the AppSecret is invalid or has been reset.
- `48001`: the Official Account does not have draft API permission.

AppSecret is a high-privilege credential. Never place it in a note, frontmatter, CSS, issue, screenshot, or Git repository. This plugin does **not** need a callback server URL, Token, EncodingAESKey, business domain, JS API security domain, or OAuth domain.

## Content modes

### CSS layout

The plugin renders Markdown with Obsidian, applies your CSS, and converts supported declarations into inline styles. It handles headings, paragraphs, lists, blockquotes, callouts, code blocks, tables, and images. Pseudo-elements, complex animation, remote fonts, and some modern CSS features cannot be preserved reliably by the WeChat editor.

Use `.wechat-article` as the stable root selector:

```css
.wechat-article {
  color: #595959;
  font-size: 17px;
  line-height: 1.8;
}

.wechat-article blockquote {
  padding-left: 1em;
  border-left: 4px solid #ff6600;
  color: #777;
}
```

The render root also exposes `.markdown-here-wrapper`, `.markdown-preview-view`, and `.markdown-rendered` for compatibility with existing themes.

### Markdown plain text

Markdown syntax such as `#`, `**`, and fenced code remains literal text. The plugin preserves blank lines, indentation, and repeated spaces. Image references are not resolved in this mode, so configure a cover separately.

## Frontmatter

All draft fields are optional:

```yaml
---
wechat-title: Article title
wechat-author: Author
wechat-digest: Short summary
wechat-cover: Assets/cover.jpg
wechat-source-url: https://example.com/original
wechat-mode: styled # styled or source
wechat-theme: Themes/wechat.css
wechat-use-first-h1-as-title: true
---
```

After the first successful creation, the plugin adds a non-secret draft binding:

```yaml
wechat-draft:
  media-id: "draft ID returned by WeChat"
  account: "current Official Account AppID"
  article-index: 0
  updated-at: "2026-09-23T08:00:00.000Z"
```

Later uploads update that draft by default. Choose **Save as new draft** to keep the old draft and replace the note's binding. When duplicating a note, remove `wechat-draft` if the copy must not overwrite the original draft.

## Security and privacy

- AppSecret values are stored with Obsidian SecretStorage, not in notes or plugin `data.json`.
- Access tokens are cached only in memory and are not written to logs or exports.
- Content is sent to `api.weixin.qq.com` only after explicit confirmation.
- The plugin contains no telemetry, advertising, author-operated relay, automatic publishing, or self-update mechanism.
- Draft bindings never contain an AppSecret or access token.

Never commit AppSecrets, access tokens, `.env` files, private keys, or certificates. Run `npm run security` before publishing changes.

## Development

```bash
npm install
npm run verify
```

Production build:

```bash
npm run build
```

## Support the project

If this plugin is useful to you, you can buy the author a coffee. Donations are entirely optional and do not unlock or affect any feature.

| WeChat Pay | Alipay |
|:---:|:---:|
| <img src="./assets/donate-wechat.jpg" width="200" alt="WeChat Pay donation code" /> | <img src="./assets/donate-alipay.jpg" width="200" alt="Alipay donation code" /> |

## Contributing

Issues and pull requests are welcome. Include the Obsidian version, operating system, plugin version, a minimal reproducible Markdown sample, and sanitized errors or screenshots. Never include an AppSecret or access token.

## Disclaimer

This is an independent community project and is not affiliated with Obsidian or Tencent's WeChat team. API permissions, content rules, and editor compatibility may change; always follow the current WeChat Official Account platform requirements.

## License

[MIT License](LICENSE)
