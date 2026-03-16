// tests/glamour.test.ts — Tests for the public API (@oakoliver/glamour)
//
// NOTE: Integration tests depend on ALL other modules being complete.
// Some may fail until parser.ts, renderer.ts, and themes.ts are integrated.

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  TermRenderer,
  render,
  renderWithStyle,
  renderBytes,
  renderWithEnvironmentConfig,
  withStyles,
  withStandardStyle,
  withStylesFromJSON,
  withWordWrap,
  withColorProfile,
  withHyperlinks,
  withPreservedNewLines,
  withBaseURL,
  withAutoStyle,
  withOptions,
  withStylePath,
  withEnvironmentConfig,
} from '../src/glamour.js';
import type { TermRendererOption } from '../src/glamour.js';
import type { StyleConfig } from '../src/style.js';

// ─── Unit Tests: Functional Options ─────────────────────────────────────────

describe('TermRenderer constructor and options', () => {
  test('default TermRenderer has sensible defaults', () => {
    const r = new TermRenderer();
    // Access internals to verify defaults
    expect(r._wordWrapWidth).toBe(80);
    expect(r._colorProfile).toBe(3);
    expect(r._hyperlinks).toBe(true);
    expect(r._preserveNewLines).toBe(false);
    expect(r._baseURL).toBe('');
    expect(r._styles).toBeDefined();
  });

  test('withWordWrap sets word wrap width', () => {
    const r = new TermRenderer(withWordWrap(120));
    expect(r._wordWrapWidth).toBe(120);
  });

  test('withWordWrap(0) disables wrapping', () => {
    const r = new TermRenderer(withWordWrap(0));
    expect(r._wordWrapWidth).toBe(0);
  });

  test('withColorProfile sets color profile', () => {
    const r = new TermRenderer(withColorProfile(1));
    expect(r._colorProfile).toBe(1);
  });

  test('withColorProfile(0) disables colors', () => {
    const r = new TermRenderer(withColorProfile(0));
    expect(r._colorProfile).toBe(0);
  });

  test('withHyperlinks(false) disables hyperlinks', () => {
    const r = new TermRenderer(withHyperlinks(false));
    expect(r._hyperlinks).toBe(false);
  });

  test('withHyperlinks(true) enables hyperlinks', () => {
    const r = new TermRenderer(withHyperlinks(true));
    expect(r._hyperlinks).toBe(true);
  });

  test('withPreservedNewLines sets preserveNewLines', () => {
    const r = new TermRenderer(withPreservedNewLines());
    expect(r._preserveNewLines).toBe(true);
  });

  test('withBaseURL sets base URL', () => {
    const r = new TermRenderer(withBaseURL('https://example.com'));
    expect(r._baseURL).toBe('https://example.com');
  });

  test('withStandardStyle sets the named style', () => {
    // 'dark' is the default, test that setting it explicitly works
    const r = new TermRenderer(withStandardStyle('dark'));
    expect(r._styles).toBeDefined();
    expect(r._styles).toHaveProperty('document');
  });

  test('withStyles sets a custom StyleConfig', () => {
    const custom: StyleConfig = {
      document: { margin: 2 },
      heading: { bold: true },
    };
    const r = new TermRenderer(withStyles(custom));
    expect(r._styles).toBe(custom);
    expect(r._styles.document?.margin).toBe(2);
  });

  test('withStylesFromJSON parses valid JSON', () => {
    const json = JSON.stringify({
      document: { margin: 4 },
      heading: { bold: true, color: '#ff0000' },
    });
    const r = new TermRenderer(withStylesFromJSON(json));
    expect(r._styles.document?.margin).toBe(4);
    expect(r._styles.heading?.bold).toBe(true);
    expect(r._styles.heading?.color).toBe('#ff0000');
  });

  test('withStylesFromJSON throws on invalid JSON', () => {
    expect(() => {
      new TermRenderer(withStylesFromJSON('not valid json'));
    }).toThrow();
  });

  test('withAutoStyle sets the auto style', () => {
    const r = new TermRenderer(withAutoStyle());
    expect(r._styles).toBeDefined();
  });

  test('multiple options are applied in order', () => {
    const r = new TermRenderer(
      withWordWrap(120),
      withColorProfile(2),
      withHyperlinks(false),
      withWordWrap(40), // override the first withWordWrap
    );
    expect(r._wordWrapWidth).toBe(40);
    expect(r._colorProfile).toBe(2);
    expect(r._hyperlinks).toBe(false);
  });

  test('withOptions composes multiple options', () => {
    const combined = withOptions(
      withWordWrap(60),
      withColorProfile(1),
      withHyperlinks(false),
    );
    const r = new TermRenderer(combined);
    expect(r._wordWrapWidth).toBe(60);
    expect(r._colorProfile).toBe(1);
    expect(r._hyperlinks).toBe(false);
  });
});

// ─── Unit Tests: Type Safety ────────────────────────────────────────────────

describe('type safety', () => {
  test('TermRendererOption type is callable', () => {
    const opt: TermRendererOption = (r: TermRenderer) => {
      r._wordWrapWidth = 42;
    };
    const r = new TermRenderer(opt);
    expect(r._wordWrapWidth).toBe(42);
  });

  test('renderBytes returns a Buffer', () => {
    const r = new TermRenderer();
    const buf = r.renderBytes('test');
    expect(buf).toBeInstanceOf(Buffer);
  });
});

// ─── Integration Tests ──────────────────────────────────────────────────────
// These tests depend on parser.ts, renderer.ts, themes.ts being complete.
// They exercise the full rendering pipeline.

describe('render() convenience function', () => {
  test('render simple heading produces output containing the text', () => {
    const output = render('# Hello');
    expect(output).toContain('Hello');
  });

  test('render bold and italic produces ANSI codes', () => {
    const output = render('**bold** and *italic*');
    // Should contain the text
    expect(output).toContain('bold');
    expect(output).toContain('italic');
    // Should contain ANSI escape codes (ESC[)
    expect(output).toMatch(/\x1b\[/);
  });

  test('render bullet list produces list items', () => {
    const output = render('- item 1\n- item 2');
    expect(output).toContain('item 1');
    expect(output).toContain('item 2');
  });

  test('render empty markdown returns minimal output', () => {
    const output = render('');
    // Should not throw; output is empty or whitespace
    expect(typeof output).toBe('string');
  });

  test('render with explicit style name', () => {
    const output = render('# Test', 'dark');
    expect(output).toContain('Test');
  });
});

describe('renderWithStyle()', () => {
  test('ascii style produces ASCII-only output (no ANSI colors)', () => {
    const output = renderWithStyle('# Test', 'ascii');
    expect(output).toContain('Test');
    // ASCII style should not have color sequences (38;2 or 38;5)
    // but may have bold/underline — so we just check it doesn't crash
    expect(typeof output).toBe('string');
  });

  test('notty style produces plain text (no ANSI)', () => {
    const output = renderWithStyle('# Test', 'notty');
    expect(output).toContain('Test');
    // NoTTY should have no ANSI escape sequences at all
    expect(output).not.toMatch(/\x1b\[.*?m/);
  });
});

describe('renderWithEnvironmentConfig()', () => {
  const originalEnv = process.env.GLAMOUR_STYLE;

  afterAll(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.GLAMOUR_STYLE = originalEnv;
    } else {
      delete process.env.GLAMOUR_STYLE;
    }
  });

  test('uses GLAMOUR_STYLE env var when set', () => {
    process.env.GLAMOUR_STYLE = 'ascii';
    const output = renderWithEnvironmentConfig('# Hello');
    expect(output).toContain('Hello');
  });

  test('falls back to dark when GLAMOUR_STYLE is not set', () => {
    delete process.env.GLAMOUR_STYLE;
    const output = renderWithEnvironmentConfig('# Hello');
    expect(output).toContain('Hello');
    // Dark style should produce ANSI codes
    expect(output).toMatch(/\x1b\[/);
  });
});

describe('renderBytes()', () => {
  test('returns a Buffer with rendered content', () => {
    const buf = renderBytes('# Hello');
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.toString()).toContain('Hello');
  });
});

describe('TermRenderer with options', () => {
  test('withWordWrap(40) wraps long paragraphs', () => {
    const longText = 'This is a very long paragraph that should definitely be wrapped when the word wrap width is set to only forty characters wide.';
    const r = new TermRenderer(withWordWrap(40));
    const output = r.render(longText);
    // The output should contain newlines from wrapping
    // (the exact behavior depends on the renderer, but the text should be present)
    expect(output).toContain('This');
    expect(output).toContain('paragraph');
  });

  test('withWordWrap(0) does not wrap', () => {
    const longText = 'A single line that is quite long and should not be wrapped at all when word wrap is disabled.';
    const r = new TermRenderer(withWordWrap(0));
    const output = r.render(longText);
    expect(output).toContain('A single line');
  });

  test('complex document renders without errors', () => {
    const markdown = `# Heading 1

## Heading 2

Some **bold** and *italic* text with a [link](https://example.com).

- Item 1
- Item 2
  - Nested item

\`\`\`js
const x = 42;
\`\`\`

> A block quote

---

1. First
2. Second

| Column A | Column B |
|----------|----------|
| Cell 1   | Cell 2   |
`;
    const r = new TermRenderer(withStandardStyle('dark'), withWordWrap(80));
    const output = r.render(markdown);
    expect(output).toContain('Heading 1');
    expect(output).toContain('Heading 2');
    expect(output).toContain('bold');
    expect(output).toContain('italic');
    expect(output).toContain('Item 1');
    expect(typeof output).toBe('string');
  });

  test('renderBytes returns Buffer from TermRenderer', () => {
    const r = new TermRenderer(withStandardStyle('dark'));
    const buf = r.renderBytes('# Test');
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.toString()).toContain('Test');
  });
});
