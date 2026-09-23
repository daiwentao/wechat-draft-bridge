export type PublishMode = "source" | "styled";

export interface WeChatDraftBridgeSettings {
  appId: string;
  appSecretKey: string;
  defaultAuthor: string;
  defaultCover: string;
  defaultMode: PublishMode;
  defaultUseFirstH1AsTitle: boolean;
  customCssPath: string;
}

export interface ArticleMetadata {
  title: string;
  author: string;
  digest: string;
  cover: string;
  sourceUrl: string;
  mode: PublishMode;
  theme: string;
  useFirstH1AsTitle: boolean;
}

export interface WeChatDraftBinding {
  mediaId: string;
  account: string;
  articleIndex: number;
  updatedAt: string;
}

export interface RenderedArticle {
  html: string;
  metadata: ArticleMetadata;
  warnings: string[];
  sourcePath: string;
}

export interface BinaryAsset {
  bytes: ArrayBuffer;
  mimeType: string;
  filename: string;
}

export interface PublishResult {
  mediaId: string;
  verified: boolean;
  warnings: string[];
}

export interface WeChatApiResponse {
  errcode?: number;
  errmsg?: string;
  [key: string]: unknown;
}
