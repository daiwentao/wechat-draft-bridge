import "./setup";
import { describe, expect, it, vi } from "vitest";
import { WeChatApiClient, WeChatApiError } from "../src/wechat/api";

function response(json: unknown) {
  return { json, text: JSON.stringify(json), status: 200, headers: {}, arrayBuffer: new ArrayBuffer(0) } as never;
}

describe("WeChat API client", () => {
  it("uses a stable token and reads draft capability", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response({ access_token: "fake-token", expires_in: 7200 }))
      .mockResolvedValueOnce(response({ total_count: 3 }));
    const client = new WeChatApiClient("wx-test", "fake-secret-value", request);
    await expect(client.testCapability()).resolves.toBe(3);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[0]).toMatchObject({ url: "https://api.weixin.qq.com/cgi-bin/stable_token", method: "POST" });
  });

  it("maps account permission errors without exposing credentials", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response({ access_token: "fake-token", expires_in: 7200 }))
      .mockResolvedValueOnce(response({ errcode: 48001, errmsg: "api unauthorized" }));
    const client = new WeChatApiClient("wx-test", "fake-secret-value", request);
    await expect(client.testCapability()).rejects.toMatchObject({ errcode: 48001, stage: "capability" } satisfies Partial<WeChatApiError>);
    try {
      await client.testCapability();
    } catch (error) {
      expect(String(error)).not.toContain("fake-secret-value");
    }
  });

  it("upgrades an HTTP image URL returned by WeChat to HTTPS", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response({ access_token: "fake-token", expires_in: 7200 }))
      .mockResolvedValueOnce(response({ url: "http://mmbiz.qpic.cn/example/image.jpg" }));
    const client = new WeChatApiClient("wx-test", "fake-secret-value", request);
    const asset = { bytes: new Uint8Array([1, 2, 3]).buffer, mimeType: "image/jpeg", filename: "image.jpg" };

    await expect(client.uploadContentImage(asset)).resolves.toBe("https://mmbiz.qpic.cn/example/image.jpg");
  });

  it("creates and verifies a draft without calling publish APIs", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response({ access_token: "fake-token", expires_in: 7200 }))
      .mockResolvedValueOnce(response({ media_id: "draft-media-id" }))
      .mockResolvedValueOnce(response({ content: { news_item: [{ title: "标题" }] } }));
    const client = new WeChatApiClient("wx-test", "fake-secret-value", request);
    const result = await client.createDraft(
      { title: "标题", author: "", digest: "", cover: "", sourceUrl: "", mode: "styled", theme: "default", useFirstH1AsTitle: false },
      "<p>正文</p>",
      "cover-media-id"
    );
    expect(result).toMatchObject({ mediaId: "draft-media-id", verified: true });
    expect(JSON.stringify(request.mock.calls)).not.toContain("freepublish");
  });

  it("updates and verifies the first article in an existing draft", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response({ access_token: "fake-token", expires_in: 7200 }))
      .mockResolvedValueOnce(response({ errcode: 0, errmsg: "ok" }))
      .mockResolvedValueOnce(response({ content: { news_item: [{ title: "新标题" }] } }));
    const client = new WeChatApiClient("wx-test", "fake-secret-value", request);
    const result = await client.updateDraft(
      "draft-media-id",
      0,
      { title: "新标题", author: "", digest: "", cover: "", sourceUrl: "", mode: "styled", theme: "default", useFirstH1AsTitle: false },
      "<p>新正文</p>",
      "cover-media-id"
    );

    expect(result).toMatchObject({ mediaId: "draft-media-id", verified: true });
    const updateRequest = request.mock.calls[1]?.[0] as { url: string; body: string };
    expect(updateRequest.url).toContain("/cgi-bin/draft/update");
    expect(JSON.parse(updateRequest.body)).toMatchObject({
      media_id: "draft-media-id",
      index: 0,
      articles: { title: "新标题", content: "<p>新正文</p>", thumb_media_id: "cover-media-id" }
    });
  });

  it("reads an associated draft before replacement", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response({ access_token: "fake-token", expires_in: 7200 }))
      .mockResolvedValueOnce(response({ content: { news_item: [{ title: "原标题" }] } }));
    const client = new WeChatApiClient("wx-test", "fake-secret-value", request);

    await expect(client.getDraftArticle("draft-media-id", 0)).resolves.toEqual({ title: "原标题" });
    expect((request.mock.calls[1]?.[0] as { url: string }).url).toContain("/cgi-bin/draft/get");
  });
});
