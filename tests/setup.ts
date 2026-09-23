import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://local.test" });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  DOMParser: dom.window.DOMParser,
  NodeFilter: dom.window.NodeFilter,
  Node: dom.window.Node,
  HTMLElement: dom.window.HTMLElement
});
