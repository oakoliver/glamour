// tests/layout-parity.test.ts — rendered layout compared with upstream glamour
// v2.0.1. Expected lines come from upstream's golden files or from rendering
// the same input with the Go library, with ANSI removed and trailing spaces
// trimmed (upstream pads every line to the wrap width; this port does not).

import { describe, expect, test } from 'bun:test';
import {
  newTermRenderer,
  stripAnsi,
  withStandardStyle,
  withStyles,
  withWordWrap,
} from '../src/index.js';
import { wordWrap } from '../src/baseelement.js';
import { Pen, escapeAt } from './support/pen.js';

const lines = (output: string) =>
  stripAnsi(output.replace(/\x1b\]8;[^\x07]*\x07/g, '')).split('\n').map((l) => l.trimEnd());

const renderStyle = (md: string, style: string, width: number) =>
  newTermRenderer(withStandardStyle(style), withWordWrap(width)).render(md);

describe('block quotes', () => {
  test('use indent_token (upstream golden TestRenderer/block_quote)', () => {
    const style = { block_quote: { color: '200', indent: 1, indent_token: '=> ' } };
    const out = newTermRenderer(withStyles(style), withWordWrap(80))
      .render('> First line of quote\n> Second line\n');
    expect(lines(out).filter(Boolean)).toEqual(['=> First line of quote Second line']);
  });

  test('nest their indent tokens', () => {
    const md = '> First line of quote\n> Second line\n>\n> > nested quote here\n\nAfter the quote.\n';
    expect(lines(renderStyle(md, 'dark', 44))).toEqual([
      '', '', '  │ First line of quote Second line', '  │', '  │ │ nested quote here',
      '', '  After the quote.', '', '',
    ]);
  });
});

describe('wrapping', () => {
  test('paragraphs break only at whitespace and hyphens, hard-wrapping long URLs', () => {
    const md = 'This is a fairly long paragraph of text that will need to wrap at forty four columns for sure. See https://example.com/a/very/long/path/that/wraps and more.\n';
    expect(lines(renderStyle(md, 'dark', 44))).toEqual([
      '', '  This is a fairly long paragraph of text', '  that will need to wrap at forty four',
      '  columns for sure. See', '  https://example.com/a/very/long/path/tha', '  t/wraps and more.', '', '',
    ]);
  });

  test('list items use the full width', () => {
    const md = '- item one is long enough to wrap around the forty four column limit here\n- two\n';
    expect(lines(renderStyle(md, 'dark', 44)).slice(2, 5)).toEqual([
      '  • item one is long enough to wrap around', '  the forty four column limit here', '  • two',
    ]);
  });

  test('a wrapped code line keeps its indentation', () => {
    const md = "```ts\nimport { renderWithStyle } from '@oakoliver/glamour';\n\nconst out = renderWithStyle('# Hello', 'dark');\nconsole.log(out);\n```\n";
    expect(lines(renderStyle(md, 'dark', 44))).toEqual([
      '', '', '    import { renderWithStyle } from', "  '@oakoliver/glamour';", '',
      "    const out = renderWithStyle('# Hello',", "  'dark');", '    console.log(out);', '', '',
    ]);
  });

  test('closes styles before each wrapped newline and reopens them after (lipgloss.Wrap)', () => {
    expect(wordWrap('\x1b[38;5;252mHeadings, bold, italics, strikethrough and inline code\x1b[0m', 30, ' ,.;-+|'))
      .toBe('\x1b[38;5;252mHeadings, bold, italics,\x1b[m\n\x1b[38;5;252mstrikethrough and inline code\x1b[0m');
  });

  test('measures emoji graphemes as one wide character', () => {
    expect(wordWrap('emoji 👍🏽 family 👨‍👩‍👧 and café', 15))
      .toBe('emoji 👍🏽 family\n👨‍👩‍👧 and café');
  });
});

describe('code blocks', () => {
  test('never extend a background into the margin or indent', () => {
    const md = '```ts\nconst cfg = defaultConfig();\ncfg.path = x;\n```\n';
    for (const style of ['dark', 'light', 'dracula', 'tokyo-night']) {
      // Track the pen across the whole output: a background left open at the
      // end of one line colors the start of the next.
      const out = renderStyle(md, style, 80);
      const pen = new Pen();
      let atLineStart = true;
      for (let i = 0; i < out.length; ) {
        const seq = escapeAt(out, i);
        if (seq) {
          pen.advance(seq);
          i += seq.length;
          continue;
        }
        if (out[i] === '\n') atLineStart = true;
        else if (out[i] !== ' ') atLineStart = false;
        else if (atLineStart) expect(pen.restore()).not.toMatch(/\x1b\[[0-9;]*\b48;/);
        i++;
      }
    }
  });
});

describe('styles', () => {
  test('output ends with a newline, not a dangling margin', () => {
    for (const style of ['pink', 'dark', 'ascii']) {
      expect(renderStyle('hello\n', style, 80)).toMatch(/\n$/);
      expect(renderStyle('> a\n> b\n', style, 80)).toMatch(/\n$/);
    }
  });

  test('ascii marks emphasis and strong text with their block prefixes', () => {
    const out = lines(renderStyle('Some *emphasis* and **strong** text.\n', 'ascii', 80));
    expect(out).toContain('  Some *emphasis* and **strong** text.');
  });
});
