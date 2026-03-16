# @oakoliver/glamour

Stylesheet-based markdown rendering for the terminal. A pure TypeScript port of [charmbracelet/glamour](https://github.com/charmbracelet/glamour) with zero dependencies (except the optional `@oakoliver/lipgloss` peer dependency for table rendering).

## Features

- Render markdown as styled ANSI terminal output
- 7 built-in themes: dark, light, ascii, dracula, tokyo-night, pink, notty
- Custom GFM markdown parser (no external dependencies)
- OSC 8 hyperlink support
- Full GFM support: tables, task lists, strikethrough, fenced code blocks
- Word-wrapping with CJK wide character support
- Works on Node.js, Bun, and Deno

## Install

```bash
npm install @oakoliver/glamour
```

## Quick Start

```typescript
import { render, renderWithTheme } from '@oakoliver/glamour';

// Render with the default dark theme
const output = render('# Hello World\n\nThis is **bold** and *italic* text.');
console.log(output);

// Render with a specific theme
const light = renderWithTheme('# Hello\n\nParagraph text.', 'light');
console.log(light);
```

## Themes

Built-in themes: `dark`, `light`, `ascii`, `dracula`, `tokyo-night`, `pink`, `notty`.

```typescript
import { renderWithTheme } from '@oakoliver/glamour';

const out = renderWithTheme('# Dracula Theme\n\n> A blockquote', 'dracula');
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

const myStyle: Partial<StyleConfig> = {
  heading: { bold: true, color: '#ff6600', prefix: '>>> ' },
  paragraph: { margin: 1 },
  code: { prefix: '`', suffix: '`', color: '#00ff00' },
};

const renderer = new TermRenderer(withStyles(myStyle));
const output = renderer.render('# Orange Heading\n\nCustom styling.');
```

## API

### Top-level Functions

- `render(markdown: string, options?: RenderOption[]): string` — Render markdown with the default dark theme.
- `renderWithTheme(markdown: string, theme: string): string` — Render with a named built-in theme.

### TermRenderer

- `new TermRenderer(...options: RenderOption[])` — Create a renderer with options.
- `renderer.render(markdown: string): string` — Render markdown to styled ANSI text.
- `renderer.renderBytes(markdown: string): Uint8Array` — Render to bytes.

### Option Functions

- `withStandardStyle(name: string)` — Use a built-in theme by name.
- `withStyles(styles: Partial<StyleConfig>)` — Custom style config.
- `withWordWrap(width: number)` — Set word-wrap width (default: 80).
- `withPreservedNewLines()` — Preserve newlines in paragraphs.
- `withBaseURL(url: string)` — Resolve relative URLs against a base.
- `withEmoji()` — Enable emoji shortcode expansion.

### Parser

The custom GFM parser is also exported for direct use:

```typescript
import { parse, NodeKind } from '@oakoliver/glamour';

const ast = parse('# Hello\n\nWorld');
// Walk the AST...
```

## Attribution

This is a TypeScript port of [glamour](https://github.com/charmbracelet/glamour) by [Charmbracelet, Inc.](https://charm.sh), licensed under MIT.

## License

MIT
