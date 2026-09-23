import type { ArticleMetadata, PublishMode, WeChatDraftBinding, WeChatDraftBridgeSettings } from "../types";

const FRONTMATTER = /^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/;

export function stripFrontmatter(markdown: string): string {
  return markdown.replace(FRONTMATTER, "");
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function modeValue(value: unknown, fallback: PublishMode): PublishMode {
  return value === "source" || value === "styled" ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (/^(?:true|yes|1)$/i.test(value.trim())) return true;
    if (/^(?:false|no|0)$/i.test(value.trim())) return false;
  }
  return fallback;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function draftBindingFromFrontmatter(frontmatter: Record<string, unknown> | undefined): WeChatDraftBinding | null {
  const data = frontmatter ?? {};
  const nested = objectValue(data["wechat-draft"]);
  const mediaId = stringValue(nested?.["media-id"]) || stringValue(data["wechat-draft-id"]);
  if (!mediaId) return null;
  const rawIndex = nested?.["article-index"];
  const parsedIndex = typeof rawIndex === "number" ? rawIndex : Number.parseInt(stringValue(rawIndex), 10);
  return {
    mediaId,
    account: stringValue(nested?.account),
    articleIndex: Number.isInteger(parsedIndex) && parsedIndex >= 0 ? parsedIndex : 0,
    updatedAt: stringValue(nested?.["updated-at"])
  };
}

export function metadataFromFrontmatter(
  frontmatter: Record<string, unknown> | undefined,
  basename: string,
  settings: WeChatDraftBridgeSettings
): ArticleMetadata {
  const data = frontmatter ?? {};
  return {
    title: stringValue(data["wechat-title"]) || basename,
    author: stringValue(data["wechat-author"]) || settings.defaultAuthor,
    digest: stringValue(data["wechat-digest"]),
    cover: stringValue(data["wechat-cover"]) || settings.defaultCover,
    sourceUrl: stringValue(data["wechat-source-url"]),
    mode: modeValue(data["wechat-mode"], settings.defaultMode),
    theme: stringValue(data["wechat-theme"]) || "default",
    useFirstH1AsTitle: booleanValue(data["wechat-use-first-h1-as-title"], settings.defaultUseFirstH1AsTitle)
  };
}
