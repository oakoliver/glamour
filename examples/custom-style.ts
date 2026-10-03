/**
 * Custom StyleConfig example — the snippet from the README's "Custom Styles"
 * section, applied to a short document.
 *
 * Run:  bun examples/custom-style.ts
 */

import { TermRenderer, withStyles } from '../src/index.js';
import type { StyleConfig } from '../src/index.js';

const myStyle: StyleConfig = {
  heading: { bold: true, color: '#ff6600', prefix: '>>> ' },
  paragraph: { margin: 1 },
  code: { prefix: '`', suffix: '`', color: '#00ff00' },
};

const renderer = new TermRenderer(withStyles(myStyle));
console.log(
  renderer.render('# Orange Heading\n\nCustom styling with `inline code` in green.\n\n## Second Heading\n\nEvery element is configurable.\n'),
);
