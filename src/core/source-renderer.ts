import { stripFrontmatter } from "./frontmatter";

export interface PreparedMarkdown {
  body: string;
  firstH1: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function plainHeadingText(value: string): string {
  return value
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .trim();
}

export function prepareMarkdown(markdown: string, removeFirstH1 = false): PreparedMarkdown {
  const lines = stripFrontmatter(markdown).replace(/\r\n?/g, "\n").split("\n");
  let fenceCharacter = "";
  let fenceLength = 0;
  let firstH1 = "";
  let headingIndex = -1;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const fence = /^\s*(`{3,}|~{3,})/.exec(line)?.[1] ?? "";
    if (fence) {
      const character = fence[0] ?? "";
      if (!fenceCharacter) {
        fenceCharacter = character;
        fenceLength = fence.length;
      } else if (character === fenceCharacter && fence.length >= fenceLength) {
        fenceCharacter = "";
        fenceLength = 0;
      }
      continue;
    }
    if (fenceCharacter) continue;

    const heading = /^#(?!#)\s+(.+?)\s*#*\s*$/.exec(line)?.[1];
    if (heading) {
      firstH1 = plainHeadingText(heading);
      headingIndex = index;
      break;
    }
  }

  if (removeFirstH1 && headingIndex >= 0) lines.splice(headingIndex, 1);
  return { body: lines.join("\n"), firstH1 };
}

export function renderMarkdownSource(markdown: string, removeFirstH1 = false): string {
  const { body } = prepareMarkdown(markdown, removeFirstH1);
  const escapedLines = body.split("\n").map((line) => {
    const withTabs = line.replaceAll("\t", "    ");
    const escaped = escapeHtml(withTabs);
    const leadingSpaces = /^ +/.exec(escaped)?.[0].length ?? 0;
    const leading = "&nbsp;".repeat(leadingSpaces);
    const remaining = escaped.slice(leadingSpaces).replace(/ {2,}/g, (spaces) => "&nbsp;".repeat(spaces.length));
    return leading + remaining;
  });
  return `<p>${escapedLines.join("<br>")}</p>`;
}
