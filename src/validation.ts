import type { RenderedArticle } from "./types";

export function validateArticle(article: RenderedArticle): string[] {
  const errors: string[] = [];
  const count = (value: string) => Array.from(value).length;
  if (!article.metadata.title) errors.push("标题不能为空。");
  if (count(article.metadata.title) > 64) errors.push("标题超过 64 个字符。");
  if (count(article.metadata.author) > 16) errors.push("作者超过 16 个字符。");
  if (count(article.metadata.digest) > 128) errors.push("摘要超过 128 个字符。");
  if (article.metadata.sourceUrl && !/^https:\/\//i.test(article.metadata.sourceUrl)) errors.push("阅读原文链接必须使用 https。");
  if (!article.html.trim()) errors.push("正文不能为空。");
  if (article.html.length > 20_000) errors.push("正文 HTML 超过 20,000 字符，请精简排版或内容。");
  if (new TextEncoder().encode(article.html).byteLength > 1024 * 1024) errors.push("正文 HTML 超过 1 MB。");
  return errors;
}
