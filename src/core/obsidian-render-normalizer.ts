const OBSIDIAN_BLOCK_WRAPPER = /^el-(?:p|hr|ol|ul|h[1-6]|blockquote|pre|table)$/;

function hasMeaningfulListContent(item: Element): boolean {
  const text = (item.textContent ?? "").replace(/[\u200b\ufeff]/g, "").trim();
  if (text) return true;
  return Boolean(item.querySelector("img, table, blockquote, pre, ul, ol"));
}

/**
 * Remove Obsidian-only reading-view scaffolding before CSS selectors are
 * evaluated. This restores semantic sibling relationships such as
 * hr + p + ol and prevents visual list helpers from becoming empty markers.
 */
export function normalizeObsidianRenderedDom(container: HTMLElement): void {
  for (const helper of Array.from(container.querySelectorAll(
    ".list-bullet, .list-collapse-indicator, .collapse-indicator, .heading-collapse-indicator"
  ))) helper.remove();

  const wrappers = Array.from(container.querySelectorAll("div")).filter((element) =>
    Array.from(element.classList).some((className) => OBSIDIAN_BLOCK_WRAPPER.test(className))
  );
  for (const wrapper of wrappers) wrapper.replaceWith(...Array.from(wrapper.childNodes));

  for (const item of Array.from(container.querySelectorAll("li"))) {
    if (!hasMeaningfulListContent(item)) item.remove();
  }
  for (const list of Array.from(container.querySelectorAll("ul, ol"))) {
    if (!list.querySelector("li")) list.remove();
  }
}
