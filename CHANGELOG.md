# Changelog

All notable changes to WeChat Draft Bridge are documented here.

## 0.3.2

- Preserve inherited body colors and explicit Markdown bold styling in WeChat drafts.
- Render horizontal rules as stable WeChat-compatible line blocks while preserving theme spacing and color.
- Show the actual generated HTML character count when the WeChat 20,000-character limit is exceeded.

## 0.3.1

- Fix existing-draft validation for the top-level `news_item` returned by WeChat `draft/get`.
- Flatten paragraph wrappers inside list items before upload to prevent blank numbered entries in WeChat drafts.
- Keep compatibility with gateways that return the nested `content.news_item` draft shape.

## 0.3.0

- Save the WeChat draft ID to note frontmatter after successful creation.
- Update the linked draft on later uploads through `draft/update`.
- Add **Save as new draft** while preserving the previous draft.
- Verify the linked account and read the target draft before replacement.
- Keep uncertain create and update requests from retrying automatically.
- Add bilingual project documentation and local donation-code assets.

## 0.2.7

- Add `.markdown-here-wrapper` to the render root for Markdown Here theme compatibility.
- Improve custom CSS color and root-selector handling.

## 0.2.6

- Normalize Obsidian render wrappers before CSS inlining.
- Improve references, blockquotes, and list cleanup for WeChat.

## 0.2.0

- Add Markdown plain-text mode with preserved whitespace.
- Add first-level heading title extraction.
- Improve custom CSS selection and preview refresh behavior.

## 0.1.0

- Initial desktop release with styled preview, image upload, draft creation, rich-text copy, and HTML export.
