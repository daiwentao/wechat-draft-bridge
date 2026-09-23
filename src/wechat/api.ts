import type { RequestUrlParam, RequestUrlResponse } from "obsidian";
import type { ArticleMetadata, BinaryAsset, PublishResult, WeChatApiResponse } from "../types";
import { buildMultipart } from "./multipart";

export type RequestFunction = (request: RequestUrlParam | string) => Promise<RequestUrlResponse>;

export class WeChatApiError extends Error {
  constructor(
    message: string,
    readonly stage: "token" | "capability" | "content-image" | "cover" | "create" | "read" | "update" | "verify",
    readonly errcode?: number,
    readonly outcome: "not-created" | "uncertain" | "created" = "not-created"
  ) {
    super(message);
    this.name = "WeChatApiError";
  }
}

function messageForCode(code: number | undefined, fallback: string): string {
  if (code === 40164) return "当前出口 IP 不在公众号白名单中（40164）。请在微信开发者平台添加该 IP。";
  if (code === 48001) return "当前公众号没有此接口权限（48001）。未认证个人号请使用富文本复制兜底。";
  if (code === 40013) return "AppID 无效（40013）。";
  if (code === 40125) return "AppSecret 无效（40125）。";
  if (code === 40007) return "素材或草稿 media_id 无效（40007）。已关联草稿可能已在公众号后台删除。";
  return fallback;
}

function parseResponse(response: RequestUrlResponse): WeChatApiResponse {
  try {
    const parsed = response.json;
    if (parsed && typeof parsed === "object") return parsed as WeChatApiResponse;
  } catch {
    // Some non-JSON responses expose a throwing json getter. Fall through to text parsing.
  }
  try {
    return JSON.parse(response.text) as WeChatApiResponse;
  } catch {
    return {};
  }
}

function assertWechatOk(data: WeChatApiResponse, stage: WeChatApiError["stage"]): void {
  if (typeof data.errcode === "number" && data.errcode !== 0) {
    throw new WeChatApiError(messageForCode(data.errcode, `微信接口返回错误 ${data.errcode}：${data.errmsg ?? "未知错误"}`), stage, data.errcode);
  }
}

async function withUncertainTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  stage: "create" | "update",
  message: string
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new WeChatApiError(
      message,
      stage,
      undefined,
      "uncertain"
    )), milliseconds);
    void promise.then((value) => {
      window.clearTimeout(timeout);
      resolve(value);
    }, (error: unknown) => {
      window.clearTimeout(timeout);
      reject(error);
    });
  });
}

export class WeChatApiClient {
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly appId: string,
    private readonly appSecret: string,
    private readonly request: RequestFunction
  ) {}

  async testCapability(): Promise<number> {
    const token = await this.getToken();
    const response = await this.request(`https://api.weixin.qq.com/cgi-bin/draft/count?access_token=${encodeURIComponent(token)}`);
    const data = parseResponse(response);
    assertWechatOk(data, "capability");
    return typeof data.total_count === "number" ? data.total_count : 0;
  }

  async uploadContentImage(asset: BinaryAsset): Promise<string> {
    const token = await this.getToken();
    const multipart = buildMultipart(asset);
    const response = await this.request({
      url: `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${encodeURIComponent(token)}`,
      method: "POST",
      headers: { "Content-Type": multipart.contentType },
      body: multipart.body
    });
    const data = parseResponse(response);
    assertWechatOk(data, "content-image");
    if (typeof data.url !== "string") throw new WeChatApiError("微信未返回正文图片地址。", "content-image");
    // The uploadimg endpoint still returns an http:// mmbiz.qpic.cn URL for
    // some accounts. WeChat serves the same asset over HTTPS, while the final
    // sanitizer intentionally rejects insecure image sources.
    return data.url.trim().replace(/^http:\/\//i, "https://");
  }

  async uploadCover(asset: BinaryAsset): Promise<string> {
    const token = await this.getToken();
    const multipart = buildMultipart(asset);
    const response = await this.request({
      url: `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${encodeURIComponent(token)}&type=thumb`,
      method: "POST",
      headers: { "Content-Type": multipart.contentType },
      body: multipart.body
    });
    const data = parseResponse(response);
    assertWechatOk(data, "cover");
    if (typeof data.media_id !== "string") throw new WeChatApiError("微信未返回封面素材 ID。", "cover");
    return data.media_id;
  }

  async createDraft(metadata: ArticleMetadata, html: string, coverMediaId: string): Promise<PublishResult> {
    const token = await this.getToken();
    const response = await withUncertainTimeout(this.request({
      url: `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${encodeURIComponent(token)}`,
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ articles: [this.articlePayload(metadata, html, coverMediaId)] })
    }), 30_000, "create", "创建草稿请求超时，结果未知。请先到公众号草稿箱检查，切勿直接重试。");
    const data = parseResponse(response);
    if (typeof data.errcode === "number" && data.errcode !== 0) {
      throw new WeChatApiError(messageForCode(data.errcode, `创建草稿失败 ${data.errcode}：${data.errmsg ?? "未知错误"}`), "create", data.errcode);
    }
    if (typeof data.media_id !== "string") throw new WeChatApiError("微信未返回草稿 ID，结果未知。请检查草稿箱。", "create", undefined, "uncertain");

    const warnings: string[] = [];
    let verified = false;
    try {
      verified = await this.verifyDraft(data.media_id, metadata.title);
      if (!verified) warnings.push("草稿已创建，但回读标题不一致，请在公众号后台复核。");
    } catch (error) {
      warnings.push(`草稿已创建，但回读核验失败：${error instanceof Error ? error.message : String(error)}`);
    }
    return { mediaId: data.media_id, verified, warnings };
  }

  async getDraftArticle(mediaId: string, articleIndex = 0): Promise<{ title: string }> {
    const token = await this.getToken();
    const response = await this.request({
      url: `https://api.weixin.qq.com/cgi-bin/draft/get?access_token=${encodeURIComponent(token)}`,
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ media_id: mediaId })
    });
    const data = parseResponse(response);
    if (typeof data.errcode === "number" && data.errcode !== 0) {
      throw new WeChatApiError(messageForCode(data.errcode, `读取已关联草稿失败 ${data.errcode}：${data.errmsg ?? "未知错误"}`), "read", data.errcode);
    }
    const directItems = data.news_item as Array<{ title?: string }> | undefined;
    const content = data.content as { news_item?: Array<{ title?: string }> } | undefined;
    const article = (directItems ?? content?.news_item)?.[articleIndex];
    if (!article) throw new WeChatApiError(`已关联草稿中不存在第 ${articleIndex + 1} 篇文章。`, "read");
    return { title: typeof article.title === "string" ? article.title : "" };
  }

  async updateDraft(
    mediaId: string,
    articleIndex: number,
    metadata: ArticleMetadata,
    html: string,
    coverMediaId: string
  ): Promise<PublishResult> {
    const token = await this.getToken();
    const response = await withUncertainTimeout(this.request({
      url: `https://api.weixin.qq.com/cgi-bin/draft/update?access_token=${encodeURIComponent(token)}`,
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        media_id: mediaId,
        index: articleIndex,
        articles: this.articlePayload(metadata, html, coverMediaId)
      })
    }), 30_000, "update", "更新草稿请求超时，结果未知。请先到公众号草稿箱检查，切勿直接重试。");
    const data = parseResponse(response);
    if (typeof data.errcode === "number" && data.errcode !== 0) {
      throw new WeChatApiError(messageForCode(data.errcode, `更新草稿失败 ${data.errcode}：${data.errmsg ?? "未知错误"}`), "update", data.errcode);
    }

    const warnings: string[] = [];
    let verified = false;
    try {
      verified = await this.verifyDraft(mediaId, metadata.title, articleIndex);
      if (!verified) warnings.push("草稿已更新，但回读标题不一致，请在公众号后台复核。");
    } catch (error) {
      warnings.push(`草稿已更新，但回读核验失败：${error instanceof Error ? error.message : String(error)}`);
    }
    return { mediaId, verified, warnings };
  }

  private async verifyDraft(mediaId: string, title: string, articleIndex = 0): Promise<boolean> {
    return (await this.getDraftArticle(mediaId, articleIndex)).title === title;
  }

  private articlePayload(metadata: ArticleMetadata, html: string, coverMediaId: string): Record<string, unknown> {
    return {
      article_type: "news",
      title: metadata.title,
      author: metadata.author,
      digest: metadata.digest,
      content: html,
      content_source_url: metadata.sourceUrl,
      thumb_media_id: coverMediaId,
      need_open_comment: 0,
      only_fans_can_comment: 0
    };
  }

  private async getToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 5 * 60_000) return this.tokenCache.token;
    const response = await this.request({
      url: "https://api.weixin.qq.com/cgi-bin/stable_token",
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ grant_type: "client_credential", appid: this.appId, secret: this.appSecret, force_refresh: false })
    });
    const data = parseResponse(response);
    assertWechatOk(data, "token");
    if (typeof data.access_token !== "string") throw new WeChatApiError("微信未返回 access_token。", "token");
    const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 7200;
    this.tokenCache = { token: data.access_token, expiresAt: Date.now() + expiresIn * 1000 };
    return data.access_token;
  }
}
