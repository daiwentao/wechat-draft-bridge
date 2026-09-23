import { describe, expect, it } from "vitest";
import { buildMultipart } from "../src/wechat/multipart";

describe("multipart encoding", () => {
  it("encodes the media field and preserves binary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255]);
    const result = buildMultipart({ bytes: bytes.buffer, mimeType: "image/png", filename: "bad\"name.png" });
    const body = new Uint8Array(result.body);
    expect(result.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(new TextDecoder().decode(body.slice(0, 220))).toContain('name="media"');
    expect(new TextDecoder().decode(body.slice(0, 220))).toContain('filename="bad_name.png"');
    expect(body.some((value) => value === 254)).toBe(true);
    expect(body.some((value) => value === 255)).toBe(true);
  });
});
