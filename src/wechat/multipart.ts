import type { BinaryAsset } from "../types";

const encoder = new TextEncoder();

function concat(parts: Uint8Array[]): ArrayBuffer {
  const length = parts.reduce((total, part) => total + part.byteLength, 0);
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.byteLength;
  }
  return joined.buffer;
}

function safeFilename(filename: string): string {
  return filename.replace(/["\r\n\\/]/g, "_");
}

export function buildMultipart(asset: BinaryAsset): { body: ArrayBuffer; contentType: string } {
  const boundary = `----wechat-draft-bridge-${crypto.randomUUID()}`;
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${safeFilename(asset.filename)}"\r\nContent-Type: ${asset.mimeType}\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  return {
    body: concat([encoder.encode(header), new Uint8Array(asset.bytes), encoder.encode(footer)]),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}
