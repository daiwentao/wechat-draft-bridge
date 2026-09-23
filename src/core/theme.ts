export const DEFAULT_THEME_CSS = `
.wechat-article { color: #222; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 16px; line-height: 1.8; overflow-wrap: break-word; }
.wechat-article p { margin: 0 0 1em; letter-spacing: 0.02em; }
.wechat-article h1 { margin: 1.5em 0 0.8em; font-size: 1.7em; line-height: 1.35; }
.wechat-article h2 { margin: 1.5em 0 0.8em; padding-left: 0.65em; border-left: 4px solid #576b95; font-size: 1.4em; line-height: 1.4; }
.wechat-article h3 { margin: 1.35em 0 0.7em; color: #3f4e68; font-size: 1.16em; }
.wechat-article blockquote { margin: 1em 0; padding: 0.8em 1em; border-left: 4px solid #b7c4dc; background: #f5f7fa; color: #4b5563; }
.wechat-article ul, .wechat-article ol { margin: 0 0 1em; padding-left: 1.8em; }
.wechat-article li { margin: 0.3em 0; }
.wechat-article pre { margin: 1em 0; padding: 1em; border-radius: 8px; background: #f6f8fa; white-space: pre-wrap; overflow-wrap: anywhere; }
.wechat-article code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.9em; }
.wechat-article table { width: 100%; margin: 1em 0; border-collapse: collapse; font-size: 0.92em; }
.wechat-article th, .wechat-article td { padding: 0.55em 0.65em; border: 1px solid #d8dee4; text-align: left; }
.wechat-article th { background: #f6f8fa; }
.wechat-article img { display: block; max-width: 100%; height: auto; margin: 1em auto; }
.wechat-article a { color: #576b95; text-decoration: underline; }
.wechat-article hr { margin: 2em auto; border: 0; border-top: 1px solid #d8dee4; }
.wechat-article .callout { margin: 1em 0; padding: 0.8em 1em; border: 1px solid #d9e2f2; border-radius: 8px; background: #f7f9fc; }
`;

export function inspectCss(css: string): string[] {
  const warnings: string[] = [];
  if (/::(?:before|after)\b/i.test(css)) warnings.push("自定义 CSS 含伪元素；公众号正文不会保留伪元素内容。");
  if (/@media\b/i.test(css)) warnings.push("自定义 CSS 含媒体查询；导出时会忽略媒体查询。");
  if (/@import\b/i.test(css)) warnings.push("自定义 CSS 含 @import；插件不会加载外部样式。");
  if (/url\s*\(\s*["']?javascript:/i.test(css)) warnings.push("自定义 CSS 含不安全 URL，相关声明会被移除。");
  if (/position\s*:\s*(?:fixed|sticky)/i.test(css)) warnings.push("fixed/sticky 定位不适用于公众号正文，相关声明会被移除。");
  return warnings;
}
