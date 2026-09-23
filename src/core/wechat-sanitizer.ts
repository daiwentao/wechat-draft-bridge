const ALLOWED_TAGS = new Set([
  "A", "BLOCKQUOTE", "BR", "CODE", "DEL", "DIV", "EM", "FIGCAPTION", "FIGURE", "H1", "H2", "H3",
  "H4", "H5", "H6", "HR", "IMG", "LI", "OL", "P", "PRE", "S", "SECTION", "SPAN", "STRONG", "SUB",
  "SUP", "TABLE", "TBODY", "TD", "TH", "THEAD", "TR", "U", "UL"
]);
const DROP_WITH_CONTENT_TAGS = new Set(["AUDIO", "BUTTON", "CANVAS", "EMBED", "FORM", "IFRAME", "INPUT", "OBJECT", "SCRIPT", "STYLE", "SVG", "VIDEO"]);

const ALLOWED_ATTRIBUTES = new Set(["alt", "height", "href", "src", "style", "title", "width"]);
const ALLOWED_STYLE_PROPERTIES = new Set([
  "background", "background-color", "border", "border-bottom", "border-color", "border-left", "border-radius",
  "border-right", "border-style", "border-top", "border-width", "box-sizing", "color", "display", "font-family",
  "font-size", "font-style", "font-weight", "height", "letter-spacing", "line-height", "margin", "margin-bottom",
  "margin-left", "margin-right", "margin-top", "max-width", "min-width", "overflow-wrap", "padding", "padding-bottom",
  "padding-left", "padding-right", "padding-top", "text-align", "text-decoration", "text-indent", "vertical-align",
  "white-space", "width", "word-break"
]);

function safeUrl(value: string, image: boolean): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^https:\/\//i.test(trimmed)) return true;
  if (image && /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,/i.test(trimmed)) return true;
  if (!image && /^(?:mailto:|#)/i.test(trimmed)) return true;
  return false;
}

function cleanStyle(element: HTMLElement): void {
  const style = element.style;
  for (const property of Array.from(style)) {
    const value = style.getPropertyValue(property);
    if (!ALLOWED_STYLE_PROPERTIES.has(property) || /(?:expression\s*\(|javascript:|url\s*\()/i.test(value)) {
      style.removeProperty(property);
    }
  }
  if (!style.length) element.removeAttribute("style");
}

function flattenListItemParagraphs(document: Document): void {
  for (const item of Array.from(document.body.querySelectorAll("li"))) {
    const paragraphs = Array.from(item.children).filter((child) => child.tagName === "P");
    for (const paragraph of paragraphs) {
      const hasContentBefore = Array.from(item.childNodes).some((node) => {
        if (node === paragraph) return false;
        if (node.compareDocumentPosition(paragraph) & Node.DOCUMENT_POSITION_PRECEDING) return false;
        return node.nodeType === Node.ELEMENT_NODE || Boolean(node.textContent?.trim());
      });
      if (hasContentBefore) paragraph.before(document.createElement("br"));
      paragraph.replaceWith(...Array.from(paragraph.childNodes));
    }
  }
}

export interface SanitizeResult {
  html: string;
  warnings: string[];
}

export function sanitizeWechatHtml(html: string): SanitizeResult {
  const parser = new DOMParser();
  const document = parser.parseFromString(`<body>${html}</body>`, "text/html");
  const warnings: string[] = [];

  // Obsidian injects visual bullet and collapse controls into rendered lists.
  // WeChat already renders native <li> markers, so keeping these helpers creates
  // an extra empty bullet line before every real list item.
  for (const helper of Array.from(document.body.querySelectorAll(
    ".list-bullet, .list-collapse-indicator, .collapse-indicator, .heading-collapse-indicator"
  ))) helper.remove();

  for (const element of Array.from(document.body.querySelectorAll("*"))) {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      warnings.push(`已移除公众号不支持的 <${element.tagName.toLowerCase()}> 元素。`);
      if (DROP_WITH_CONTENT_TAGS.has(element.tagName)) element.remove();
      else element.replaceWith(...Array.from(element.childNodes));
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || !ALLOWED_ATTRIBUTES.has(name)) element.removeAttribute(attribute.name);
    }
    if (element instanceof HTMLElement) cleanStyle(element);
    if (element.tagName === "IMG" && !safeUrl(element.getAttribute("src") ?? "", true)) {
      warnings.push("发现尚未上传的本地或不安全图片地址；创建草稿前必须替换。");
    }
    if (element.tagName === "A" && !safeUrl(element.getAttribute("href") ?? "", false)) {
      element.removeAttribute("href");
      warnings.push("已移除不安全或非 HTTPS 链接。");
    }
  }

  // WeChat may split block paragraphs inside <li> into extra list entries.
  // Flatten Obsidian's loose-list markup before uploading while preserving
  // paragraph separation with a simple <br> that the editor accepts reliably.
  flattenListItemParagraphs(document);

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  let comment = walker.nextNode();
  while (comment) {
    comments.push(comment);
    comment = walker.nextNode();
  }
  for (const node of comments) node.parentNode?.removeChild(node);

  for (const item of Array.from(document.body.querySelectorAll("li"))) {
    const text = (item.textContent ?? "").replace(/[\u200b\ufeff]/g, "").trim();
    const meaningfulElement = item.querySelector("img, table, blockquote, pre, ul, ol");
    if (!text && !meaningfulElement) item.remove();
  }
  for (const list of Array.from(document.body.querySelectorAll("ul, ol"))) {
    if (!list.querySelector("li")) list.remove();
  }

  return { html: document.body.innerHTML, warnings: [...new Set(warnings)] };
}
