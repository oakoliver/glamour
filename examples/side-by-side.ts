/**
 * Side by side — @oakoliver/glamour
 *
 * Renders one markdown file with two built-in glamour styles and places the
 * results next to each other with @oakoliver/lipgloss. For example:
 *
 *   bun examples/side-by-side.ts examples/doc.md dracula tokyo-night
 *   bun examples/side-by-side.ts examples/code.md tokyo-night dark
 *
 * Usage: bun examples/side-by-side.ts [file.md] [styleA] [styleB] [wrap]
 *   file.md  markdown to render (default: examples/doc.md)
 *   styleA   left style  (default: dracula)
 *   styleB   right style (default: tokyo-night)
 *   wrap     word-wrap width per pane (default: 64; best at 138 columns)
 *
 * Styles: dark, light, dracula, tokyo-night, pink, ascii, notty.
 * Needs @oakoliver/lipgloss >= 1.1.0 (for blend1D); see examples/README.md.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  TermRenderer, defaultStyles, withStandardStyle, withWordWrap, withColorProfile, withChromaFormatter,
} from '../src/index.js';
// Namespace import so an older @oakoliver/lipgloss without blend1D gets a clear
// error below instead of a module-link SyntaxError.
import * as lipgloss from '@oakoliver/lipgloss';
import type { Color } from '@oakoliver/lipgloss';

const args = process.argv.slice(2);
const file = args[0] ?? fileURLToPath(new URL('./doc.md', import.meta.url));
const styleA = args[1] ?? 'dracula';
const styleB = args[2] ?? 'tokyo-night';
const WRAP = Number(args[3] ?? 64);

function fail(msg: string): never {
  process.stderr.write(`side-by-side: ${msg}\n`);
  process.exit(1);
}
if (!existsSync(file)) fail(`markdown file not found: ${file}`);
for (const s of [styleA, styleB]) {
  if (!(s in defaultStyles)) fail(`unknown style "${s}" (try: ${Object.keys(defaultStyles).join(', ')})`);
}
if (!Number.isInteger(WRAP) || WRAP < 20) fail(`wrap width must be an integer >= 20, got "${args[3]}"`);
if (typeof (lipgloss as Record<string, unknown>).blend1D !== 'function') {
  fail('@oakoliver/lipgloss >= 1.1.0 is required (blend1D is missing); see examples/README.md');
}
const { newStyle, joinHorizontal, joinVertical, blend1D, Top, Left } = lipgloss;

const md = readFileSync(file, 'utf8');

const ACCENT: Record<string, [Color, Color]> = {
  dracula: ['#BD93F9', '#FF79C6'],
  'tokyo-night': ['#7AA2F7', '#BB9AF7'],
  pink: ['#FF5FD2', '#FFAFD7'],
  dark: ['#5FAFFF', '#00D7AF'],
};

function pane(style: string): string {
  const out = new TermRenderer(
    withStandardStyle(style), withWordWrap(WRAP), withColorProfile(3), withChromaFormatter('terminal16m'),
  ).render(md).replace(/^\n+/, '').replace(/\n+$/, '');
  const [c1, c2] = ACCENT[style] ?? ['#888888', '#AAAAAA'];
  const label = ` withStandardStyle("${style}") `;
  const tab = blend1D(label.length, c1, c2)
    .map((c, i) => newStyle().background(c).foreground('#15151F').bold(true).render(label[i])).join('');
  const rule = newStyle().foreground('#33354A').render('─'.repeat(WRAP + 2));
  return joinVertical(Left, '  ' + tab, rule, out);
}

const left = pane(styleA), right = pane(styleB);
const h = Math.max(left.split('\n').length, right.split('\n').length);
const divider = newStyle().foreground('#2E3044').render(Array(h).fill(' │ ').join('\n'));
process.stdout.write('\n' + joinHorizontal(Top, left, divider, right) + '\n');
