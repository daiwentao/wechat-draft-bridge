import juice from "juice";
import { DEFAULT_THEME_CSS, inspectCss } from "./theme";

export interface InlineCssResult {
  html: string;
  warnings: string[];
}

export interface InlineCssContext {
  cssVariables?: Record<string, string>;
  themeClass?: "theme-light" | "theme-dark";
}

export function referencedCssVariables(css: string): string[] {
  return [...new Set(Array.from(css.matchAll(/var\(\s*(--[a-z0-9_-]+)/gi), (match) => match[1]).filter((name): name is string => Boolean(name)))];
}

export function inlineArticleCss(html: string, customCss = "", context: InlineCssContext = {}): InlineCssResult {
  const variables = Object.entries(context.cssVariables ?? {})
    .filter(([name, value]) => /^--[a-z0-9_-]+$/i.test(name) && Boolean(value.trim()))
    .map(([name, value]) => `${name}:${value};`)
    .join("");
  const variableCss = variables ? `.wechat-article{${variables}}` : "";
  const css = `${DEFAULT_THEME_CSS}\n${variableCss}\n${customCss}`;
  const themeClass = context.themeClass ?? "theme-light";
  const source = `<section class="${themeClass}"><section class="wechat-article markdown-here-wrapper markdown-preview-view markdown-rendered">${html}</section></section>`;
  const result = juice(source, {
    extraCss: css,
    applyStyleTags: false,
    removeStyleTags: true,
    preserveMediaQueries: false,
    preserveFontFaces: false,
    preserveKeyFrames: false,
    applyWidthAttributes: false,
    applyHeightAttributes: false
  });
  const warnings = inspectCss(customCss);
  if (/var\(\s*--/i.test(result)) warnings.push("部分 CSS 颜色变量无法解析；请在 CSS 中为变量提供具体颜色值。");
  return { html: result, warnings };
}
