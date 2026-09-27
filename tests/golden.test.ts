// Golden parity tests against real charmbracelet/glamour v2.0.1 output.
//
// tests/golden/v2.0.1/*.golden were rendered by charm.land/glamour/v2@v2.0.1
// (glamour.NewTermRenderer(WithStandardStyle(style), WithWordWrap(width)))
// from tests/golden/fixtures/*.md; tests/golden/upstream/ holds glamour's own
// renderer_test.go corpus (styles/examples and testdata/issues) re-rendered
// with the options its tests use.
//
// Comparisons are byte-for-byte. The only exception is syntax highlighting:
// upstream lexes code with chroma, this port with highlight.js, so the SGR
// sequences on highlighted code lines may differ. Such a line must still be
// identical once SGR sequences are removed, and it must be a chroma-rendered
// code line (chroma's formatter ends tokens with ESC[0m, which glamour itself
// never emits) or a wrapped continuation of one.

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TermRenderer,
  parse,
  renderAST,
  withStandardStyle,
  withWordWrap,
} from '../src/index.js';
import type { StyleConfig } from '../src/style.js';

const ROOT = join(import.meta.dir, 'golden');
const SGR = /\x1b\[[0-9;:]*m/g;
const CHROMA_STYLES = new Set(['dark', 'light', 'dracula', 'tokyo-night']);

interface Comparison {
  exact: boolean;
  /** Lines that differ only in SGR inside highlighted code. */
  codeLines: number;
  /** Lines that differ in any other way. */
  mismatches: string[];
}

function compare(got: string, want: string, allowCodeSGR: boolean): Comparison {
  if (got === want) return { exact: true, codeLines: 0, mismatches: [] };
  const gl = got.split('\n');
  const wl = want.split('\n');
  const mismatches: string[] = [];
  let codeLines = 0;
  let previousWasCode = false;
  for (let i = 0; i < Math.max(gl.length, wl.length); i++) {
    const g = gl[i];
    const w = wl[i];
    if (g === w) {
      previousWasCode = w !== undefined && w.includes('\x1b[0m');
      continue;
    }
    const sgrOnly = g !== undefined && w !== undefined && g.replace(SGR, '') === w.replace(SGR, '');
    const isCode = w !== undefined && g !== undefined &&
      (w.includes('\x1b[0m') || g.includes('\x1b[0m') || previousWasCode);
    if (allowCodeSGR && sgrOnly && isCode) {
      codeLines++;
      previousWasCode = true;
      continue;
    }
    mismatches.push(`line ${i}:\n  want ${JSON.stringify(w)}\n  got  ${JSON.stringify(g)}`);
    previousWasCode = false;
  }
  return { exact: false, codeLines, mismatches };
}

function expectParity(got: string, want: string, allowCodeSGR: boolean): Comparison {
  const result = compare(got, want, allowCodeSGR);
  expect(result.mismatches.slice(0, 3)).toEqual([]);
  expect(got.replace(SGR, '')).toBe(want.replace(SGR, ''));
  return result;
}

// ─── Fixtures × styles × widths ─────────────────────────────────────────────

describe('glamour v2.0.1 golden matrix', () => {
  const goldens = readdirSync(join(ROOT, 'v2.0.1')).filter((f) => f.endsWith('.golden')).sort();
  let exact = 0;

  test('covers every fixture in all seven styles at widths 40 and 80', () => {
    const fixtures = readdirSync(join(ROOT, 'fixtures')).filter((f) => f.endsWith('.md'));
    expect(goldens.length).toBe(fixtures.length * 7 * 2);
  });

  for (const golden of goldens) {
    const [name, style, width] = golden.replace(/\.golden$/, '').split('.');
    test(`${name} · ${style} · ${width}`, () => {
      const markdown = readFileSync(join(ROOT, 'fixtures', `${name}.md`), 'utf8');
      const want = readFileSync(join(ROOT, 'v2.0.1', golden), 'utf8');
      const got = new TermRenderer(withStandardStyle(style), withWordWrap(Number(width))).render(markdown);
      const result = expectParity(got, want, CHROMA_STYLES.has(style));
      if (result.exact) exact++;
      // Everything except chroma-highlighted code is byte-identical.
      if (!CHROMA_STYLES.has(style) || !markdown.includes('```')) expect(result.exact).toBe(true);
    });
  }

  test('byte-exact count', () => {
    // Only fixtures with highlighted fenced code in chroma styles may differ.
    const highlighted = goldens.filter((g) => {
      const [name, style] = g.split('.');
      return CHROMA_STYLES.has(style) && readFileSync(join(ROOT, 'fixtures', `${name}.md`), 'utf8')
        .includes('```');
    });
    expect(exact).toBeGreaterThanOrEqual(goldens.length - highlighted.length);
  });
});

// ─── Upstream renderer_test.go corpus ───────────────────────────────────────

/**
 * Styles that name a built-in chroma theme ("theme": "solarized-dark") instead
 * of defining chroma rules. chroma's theme palettes are not ported, so such
 * code blocks use the code_block colors: same text, different SGR.
 */
const NAMED_CHROMA_THEME = new Set(['examples/code_block']);

describe('glamour v2.0.1 renderer_test corpus', () => {
  const run = (dir: string, name: string, styles: StyleConfig, extra: Record<string, unknown>): void => {
    const markdown = readFileSync(join(ROOT, 'upstream', dir, `${name}.md`), 'utf8');
    const want = readFileSync(join(ROOT, 'upstream', dir, `${name}.golden`), 'utf8');
    const got = renderAST(parse(markdown, { emoji: true }), {
      styles,
      wordWrap: 80,
      colorProfile: 3,
      hyperlinks: true,
      preserveNewLines: false,
      ...extra,
    });
    if (NAMED_CHROMA_THEME.has(`${dir}/${name}`)) {
      expect(got.replace(SGR, '')).toBe(want.replace(SGR, ''));
      return;
    }
    expectParity(got, want, true);
  };

  const examples = readdirSync(join(ROOT, 'upstream', 'examples'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3))
    .sort();
  for (const name of examples) {
    test(`examples/${name}`, () => {
      const styles = JSON.parse(
        readFileSync(join(ROOT, 'upstream', 'examples', `${name}.style`), 'utf8'),
      ) as StyleConfig;
      const extra: Record<string, unknown> = {};
      if (name === 'table_truncate') extra.tableWrap = false;
      if (name === 'table_with_inline_links') extra.inlineTableLinks = true;
      run('examples', name, styles, extra);
    });
  }

  const dark = JSON.parse(readFileSync(join(ROOT, 'upstream', 'dark.json'), 'utf8')) as StyleConfig;
  const issues = readdirSync(join(ROOT, 'upstream', 'issues'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3))
    .sort();
  for (const name of issues) {
    test(`issues/${name}`, () => {
      run('issues', name, dark, name === '493' ? { tableWrap: false } : {});
    });
  }
});

// ─── Regressions from real renders ──────────────────────────────────────────

describe('rendering regressions', () => {
  const render = (markdown: string, style = 'dark', width = 40): string =>
    new TermRenderer(withStandardStyle(style), withWordWrap(width)).render(markdown);
  const plain = (s: string): string => s.replace(SGR, '');

  test('a thematic break prints its format once', () => {
    const lines = plain(render('---', 'ascii')).split('\n');
    expect(lines.filter((line) => line.includes('--------'))).toHaveLength(1);
  });

  test('nested lists are indented by level_indent per level', () => {
    const lines = plain(render('- a\n  - b\n    - c', 'dark')).split('\n');
    expect(lines).toContain(`  • a${' '.repeat(33)}`);
    expect(lines.some((line) => line.startsWith('    • b'))).toBe(true);
    expect(lines.some((line) => line.startsWith('      • c'))).toBe(true);
  });

  test('blockquotes draw the indent token in dark and tokyo-night', () => {
    for (const style of ['dark', 'tokyo-night']) {
      const lines = plain(render('> quoted', style)).split('\n');
      expect(lines.some((line) => line.startsWith('  │ quoted'))).toBe(true);
    }
  });

  test('bold and italic keep their theme colors inside text', () => {
    const out = render('a **bold** and *italic* b', 'dracula', 80);
    expect(out).toContain('\x1b[38;2;255;184;108;1mbold\x1b[m');
    expect(out).toContain('\x1b[38;2;241;250;140;3mitalic\x1b[m');
  });

  test('wrapped code closes its style before every line break', () => {
    const out = render('```go\nfmt.Println("a very long line of Go code that must wrap here")\n```', 'dark', 40);
    for (const line of out.split('\n')) {
      const sequences = line.match(SGR) ?? [];
      const last = sequences[sequences.length - 1];
      // no style may stay open into the next line's margin
      if (last !== undefined) expect(['\x1b[m', '\x1b[0m']).toContain(last);
    }
  });

  test('highlighted code does not paint the chroma background', () => {
    const out = render('```go\nfunc main() {}\n```', 'dark', 40);
    expect(out).not.toContain('48;5;');
  });
});
