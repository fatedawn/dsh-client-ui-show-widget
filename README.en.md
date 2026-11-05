# dsh-client-ui-show-widget

Inline widgets for DeepSeek Harness: a `show_widget` tool that renders model-authored HTML/SVG fragments as cards in the conversation, with Mermaid and KaTeX bundled offline.

- Package: `dsh-client-ui-show-widget`
- Version: `0.2.0`
- DSH: `>=44.0.0`
- License: MIT

## Why

Models describe structure with prose and Markdown tables. Prose forces the reader to rebuild the diagram in their head; tables overflow in narrow windows and cannot express a flow. The alternatives are worse: writing a file interrupts the conversation, image URLs need hosting, ASCII art breaks on any font change.

This plugin keeps the diagram inside the transcript: scrollable, inline between paragraphs, produced on demand.

## What it does

One tool call produces one card. Measured on DSH 44.7.0 with four widgets in one turn:

- Comparison table: 696 px card, intact rounded border, no horizontal overflow.
- Mermaid flowchart: real `<svg>` output, 1287 px card.
- Height: reported from the frame's `scrollHeight`, clamped to 20–2000 px.
- Theme: follows `prefers-color-scheme`; Mermaid switches between `dark` and `default`.

The card body is a `sandbox="allow-scripts"` `srcdoc` iframe with an opaque origin. CSP `default-src 'none'` blocks every external request, so a widget cannot phone home, load a remote image, or reach the parent document.

The tool returns a short receipt (`Widget "title" rendered`) instead of the widget source, so the HTML is not counted twice in context.

## When to use it

Architecture and request flows, option matrices, sequence and state diagrams, gantt and timelines, math derivations, proportions and trends, step-by-step visual guides. Not for anything you need to keep as a file, or for a two-sentence answer.

## Install

Add the market index URL in DSH's plugin market:

```
https://raw.githubusercontent.com/fatedawn/dsh-client-ui-show-widget/main/market/index.json
```

Then install `dsh-client-ui-show-widget` from Discover. The index entry pins this repository to an exact commit, so every install reproduces the same code.

Manual install, from a profile directory:

```bash
pnpm add dsh-client-ui-show-widget@git+https://github.com/fatedawn/dsh-client-ui-show-widget.git#22ff0cf2a9a77241a13485e21468221fde5ad223
```

## How it works

- `lib/index.js` (Host): registers the `show-widget:policy` system-prompt section and the `show_widget` tool (`title`, `widget_code`, `loading_messages`).
- `lib/client.js` (Web): attaches the tool card and the turn tail. Frames are located by `data-widget-frame` attributes rather than React refs, because the host re-renders slot content into new containers and refs go stale.
- Height reporting runs on one module-level interval (`window.__DSH_WIDGET_TICK`) instead of per-component effects, so the first report cannot be clamped to the minimum before layout.
- Bare ```` ```mermaid ```` fences in prose are lifted into cards. `<br>` inside labels is replaced by a placeholder and adjacent text nodes are merged with `root.normalize()` before lifting, otherwise the fence is split and half the source leaks as plain text.
- `lib/client.js` is ~8 MB because Mermaid and KaTeX are inlined. That is the cost of zero external requests.

## Develop

```bash
npm run build   # inline vendor/ into lib/client.js
npm test        # verify-render + verify-tail + verify-tool-runtime
```

`lib/client.src.js` is the readable source; `lib/client.js` is the built artifact. Rebuild after every source edit.

## Known limitations

- Mermaid's dagre layout can fail inside a very narrow container (`Could not find a suitable point for the given distance`); the card then shows an error box. Split the diagram or use an HTML table.
- No live updates: a card is a snapshot taken when the tool ran.
- Height cap is 2000 px; taller content scrolls inside the frame.
- No external resources by design: use `data:` URLs or inline SVG for images.
