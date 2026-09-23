import { App, TFile, requestUrl } from "obsidian";
import type { BinaryAsset } from "./types";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);

function extensionMime(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" } as Record<string, string>)[extension ?? ""] ?? "application/octet-stream";
}

function bytesToBase64(bytes: ArrayBuffer): string {
  const data = new Uint8Array(bytes);
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < data.length; offset += chunk) {
    binary += String.fromCharCode(...data.subarray(offset, offset + chunk));
  }
  return activeWindow.btoa(binary);
}

function dataUrlToAsset(url: string, filename = "embedded-image"): BinaryAsset {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(url);
  if (!match?.[1] || !match[2]) throw new Error("不支持的内嵌图片格式");
  const binary = activeWindow.atob(match[2].replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return { bytes: bytes.buffer, mimeType: match[1].toLowerCase(), filename };
}

function normalizedSource(value: string): string {
  return decodeURIComponent(value.split("#")[0]?.split("?")[0] ?? value);
}

async function loadBrowserImage(asset: BinaryAsset): Promise<HTMLImageElement> {
  const runtimeWindow = activeWindow as unknown as typeof globalThis;
  const url = runtimeWindow.URL.createObjectURL(new Blob([asset.bytes], { type: asset.mimeType }));
  try {
    const image = new runtimeWindow.Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    runtimeWindow.URL.revokeObjectURL(url);
  }
}

async function canvasBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片编码失败")), mimeType, quality);
  });
}

export async function optimizeImage(asset: BinaryAsset, targetBytes: number, cover = false): Promise<BinaryAsset> {
  const accepted = asset.mimeType === "image/png" || asset.mimeType === "image/jpeg";
  if (!cover && accepted && asset.bytes.byteLength <= targetBytes) return asset;

  const image = await loadBrowserImage(asset);
  const canvas = activeWindow.document.createElement("canvas");
  const maxWidth = cover ? 900 : 1600;
  let width = Math.min(image.naturalWidth, maxWidth);
  let height = Math.max(1, Math.round(image.naturalHeight * (width / image.naturalWidth)));
  let quality = cover ? 0.88 : 0.9;
  let encoded: Blob | null = null;

  for (let attempt = 0; attempt < 12; attempt++) {
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前环境不支持图片压缩");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    encoded = await canvasBlob(canvas, "image/jpeg", quality);
    if (encoded.size <= targetBytes) break;
    quality = Math.max(0.45, quality - 0.08);
    if (quality <= 0.5 || attempt > 6) {
      width *= 0.84;
      height *= 0.84;
    }
  }

  if (!encoded || encoded.size > targetBytes) throw new Error(`图片压缩后仍超过 ${Math.round(targetBytes / 1024)} KB`);
  return { bytes: await encoded.arrayBuffer(), mimeType: "image/jpeg", filename: asset.filename.replace(/\.[^.]+$/, "") + ".jpg" };
}

export class ImageService {
  constructor(private readonly app: App) {}

  async resolveAsset(source: string, sourcePath: string, alt = ""): Promise<BinaryAsset> {
    if (source.startsWith("data:image/")) return dataUrlToAsset(source, alt || "embedded-image");
    if (/^https:\/\//i.test(source)) {
      const response = await requestUrl({ url: source, method: "GET" });
      const contentType = Object.entries(response.headers).find(([name]) => name.toLowerCase() === "content-type")?.[1];
      const mimeType = contentType?.split(";")[0] ?? extensionMime(source);
      if (!mimeType.startsWith("image/")) throw new Error(`远程地址不是图片：${source}`);
      const name = normalizedSource(source).split("/").pop() || "remote-image";
      return { bytes: response.arrayBuffer, mimeType, filename: name };
    }

    const file = this.findVaultImage(source, sourcePath, alt);
    if (!file) throw new Error(`找不到图片：${source || alt}`);
    return { bytes: await this.app.vault.readBinary(file), mimeType: extensionMime(file.name), filename: file.name };
  }

  async embedImages(html: string, sourcePath: string): Promise<{ html: string; warnings: string[] }> {
    const document = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    const warnings: string[] = [];
    for (const image of Array.from(document.body.querySelectorAll("img"))) {
      const source = image.getAttribute("src") ?? "";
      if (/^https:\/\//i.test(source)) continue;
      try {
        const asset = await this.resolveAsset(source, sourcePath, image.alt);
        image.src = `data:${asset.mimeType};base64,${bytesToBase64(asset.bytes)}`;
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : String(error));
      }
    }
    return { html: document.body.innerHTML, warnings };
  }

  async uploadContentImages(
    html: string,
    sourcePath: string,
    upload: (asset: BinaryAsset) => Promise<string>
  ): Promise<{ html: string; firstAsset?: BinaryAsset; warnings: string[] }> {
    const document = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    const cache = new Map<string, Promise<{ url: string; asset: BinaryAsset }>>();
    const warnings: string[] = [];
    let firstAsset: BinaryAsset | undefined;

    for (const image of Array.from(document.body.querySelectorAll("img"))) {
      const source = image.getAttribute("src") ?? "";
      if (!source) continue;
      let task = cache.get(source);
      if (!task) {
        task = (async () => {
          const original = await this.resolveAsset(source, sourcePath, image.alt);
          const optimized = await optimizeImage(original, 1024 * 1024);
          return { url: await upload(optimized), asset: original };
        })();
        cache.set(source, task);
      }
      try {
        const result = await task;
        firstAsset ??= result.asset;
        image.src = result.url;
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : String(error));
      }
    }

    return { html: document.body.innerHTML, firstAsset, warnings };
  }

  private findVaultImage(source: string, sourcePath: string, alt: string): TFile | null {
    const clean = normalizedSource(source);
    const direct = this.app.vault.getAbstractFileByPath(clean.replace(/^\//, ""));
    if (direct instanceof TFile && IMAGE_EXTENSIONS.has(direct.extension.toLowerCase())) return direct;

    for (const candidate of [clean, alt]) {
      if (!candidate) continue;
      const linked = this.app.metadataCache.getFirstLinkpathDest(candidate, sourcePath);
      if (linked && IMAGE_EXTENSIONS.has(linked.extension.toLowerCase())) return linked;
    }

    const resourceMatch = this.app.vault.getFiles().find((file) => {
      if (!IMAGE_EXTENSIONS.has(file.extension.toLowerCase())) return false;
      const resource = normalizedSource(this.app.vault.getResourcePath(file));
      return resource === clean || clean.endsWith(`/${file.path}`) || clean.endsWith(`/${file.name}`);
    });
    return resourceMatch ?? null;
  }
}
