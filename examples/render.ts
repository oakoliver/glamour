/**
 * Render a markdown file to the terminal.
 *
 * Run:  bun examples/render.ts examples/sample.md [style] [width]
 *       style: dark (default), light, ascii, dracula, tokyo-night, pink, notty
 */

import { readFileSync } from 'node:fs';
import { TermRenderer, withStandardStyle, withWordWrap } from '../src/index.js';

const [file = 'examples/sample.md', style = 'dark', width = '80'] = process.argv.slice(2);

const renderer = new TermRenderer(withStandardStyle(style), withWordWrap(Number(width)));
process.stdout.write(renderer.render(readFileSync(file, 'utf8')));
