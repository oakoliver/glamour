# @oakoliver/glamour

Stylesheet-based Markdown rendering for terminals. This TypeScript port tracks
[charmbracelet/glamour](https://github.com/charmbracelet/glamour) **v2.0.1**
and preserves the package's existing TypeScript API.

## Features

- ANSI rendering with 16-color, 256-color, true-color, and no-color profiles
- Seven built-in themes: dark, light, ascii, dracula, tokyo-night, pink, notty
- CommonMark/GFM links, tables, task lists, strikethrough, code, and autolinks
- Definition lists and opt-in GitHub emoji shortcodes
- Table wrapping/truncation and inline or numbered-footer table links
- OSC 8 hyperlinks, base-URL resolution, syntax highlighting, and CJK-aware wrapping
- Node.js and Bun support

## Install

```bash
npm install @oakoliver/glamour
```

## Quick Start

```typescript
import { render, renderWithStyle } from '@oakoliver/glamour';

// Render with the default dark theme
const output = render('# Hello World\n\nThis is **bold** and *italic* text.');
console.log(output);

// Render with a specific theme
const light = renderWithStyle('# Hello\n\nParagraph text.', 'light');
console.log(light);
```

## Themes

Built-in themes: `dark`, `light`, `ascii`, `dracula`, `tokyo-night`, `pink`, `notty`.

```typescript
import { renderWithStyle } from '@oakoliver/glamour';

const out = renderWithStyle('# Dracula Theme\n\n> A blockquote', 'dracula');
```

## Advanced Usage

Use `TermRenderer` for full control over rendering options:

```typescript
import { TermRenderer, withStandardStyle, withWordWrap } from '@oakoliver/glamour';

const renderer = new TermRenderer(
  withStandardStyle('dark'),
  withWordWrap(100),
);

const output = renderer.render('# Custom Rendering\n\nWith word wrap at 100 columns.');
console.log(output);
```

## Custom Styles

Pass a `StyleConfig` object to fully customize how each markdown element is rendered:

```typescript
import { TermRenderer, withStyles } from '@oakoliver/glamour';
import type { StyleConfig } from '@oakoliver/glamour';

const myStyle: StyleConfig = {
  heading: { bold: true, color: '#ff6600', prefix: '>>> ' },
  paragraph: { margin: 1 },
  code: { prefix: '`', suffix: '`', color: '#00ff00' },
};

const renderer = new TermRenderer(withStyles(myStyle));
const output = renderer.render('# Orange Heading\n\nCustom styling.');
```

## API

### Top-level Functions

- `render(markdown, stylePath?)` — Render with the default or selected style.
- `renderWithStyle(markdown, style)` — Render with a named built-in style.
- `renderBytes(markdown, stylePath?)` — Render to a `Buffer`.
- `renderWithEnvironmentConfig(markdown)` — Read `GLAMOUR_STYLE`.

### TermRenderer

- `new TermRenderer(...options)` / `newTermRenderer(...options)` — Create a renderer.
- `renderer.render(markdown)` / `renderer.renderBytes(markdown)` — Render immediately.
- `renderer.write(chunk)`, `renderer.close()`, `renderer.read()` — Buffered writer chain.

### Option Functions

- `withStandardStyle`, `withStylePath`, `withStyles`
- `withStylesFromJSON`, `withStylesFromJSONBytes`, `withStylesFromJSONFile`
- `withWordWrap`, `withTableWrap`, `withInlineTableLinks`
- `withPreservedNewLines`, `withBaseURL`, `withEmoji`
- `withChromaFormatter`, `withColorProfile`, `withHyperlinks`
- `withEnvironmentConfig`, `withAutoStyle`, `withOptions`

### Parser

The custom GFM parser is also exported for direct use:

```typescript
import { parse, NodeKind } from '@oakoliver/glamour';

const ast = parse('# Hello\n\nWorld');
// Walk the AST...
```

## Platform-specific behavior

Upstream `styles.GetDefaultStyle("auto")` (used by `WithAutoStyle`) probes the
terminal background through Go's `termenv.HasDarkBackground`. Node.js and Bun
do not expose an equivalent cross-platform terminal-background query, so this
port resolves `auto` deterministically to the dark style. Explicit `light` and
`dark` selection remains fully supported.

## Attribution

This is a TypeScript port of [glamour](https://github.com/charmbracelet/glamour) by [Charmbracelet, Inc.](https://charm.sh), licensed under MIT.

## License

MIT
