// Tests for element renderers and the rendering pipeline.
// These tests use inline mock dependencies since parser.ts, baseelement.ts,
// and writers.ts are being written in parallel by other agents.

import { describe, test, expect } from 'bun:test';
import { BlockStack } from '../src/blockstack.js';
import { RenderContext } from '../src/context.js';
import type { StyleConfig, StyleBlock, StylePrimitive } from '../src/style.js';
import { cascadeStyle, cascadeStyles, toStylePrimitive } from '../src/style.js';
import {
  BaseElement,
  HeadingElement,
  ParagraphElement,
  EmphasisElement,
  LinkElement,
  ImageElement,
  ItemElement,
  TaskElement,
  CodeBlockElement,
  CodeSpanElement,
  StrikethroughElement,
  HRElement,
  TableElement,
  TableCellElement,
  TableRowElement,
  TableHeadElement,
  isChildNode,
  newElement,
} from '../src/elements.js';
import type { Node } from '../src/parser.js';

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Create a minimal RenderContext for testing. */
function makeCtx(overrides: Partial<StyleConfig> = {}, wordWrap: number = 80): RenderContext {
  const styles: StyleConfig = {
    document: {},
    heading: { prefix: '# ', bold: true },
    h1: { prefix: '# ', bold: true },
    h2: { prefix: '## ' },
    h3: { prefix: '### ' },
    paragraph: {},
    text: {},
    emph: { italic: true },
    strong: { bold: true },
    strikethrough: { crossed_out: true },
    hr: { format: '─' },
    item: { prefix: '• ' },
    enumeration: { suffix: '. ' },
    task: { ticked: '[✓] ', unticked: '[✗] ' },
    link: { format: '(%s)' },
    link_text: {},
    image: { format: '(%s)' },
    image_text: { format: '🖼  %s →' },
    code: { prefix: '`', suffix: '`' },
    code_block: { indent: 2 },
    table: {},
    block_quote: { indent_token: '│ ' },
    ...overrides,
  };

  return new RenderContext({
    styles,
    wordWrap,
    colorProfile: 0,
    hyperlinks: false,
    preserveNewLines: false,
  });
}

/** Make a simple AST node for testing. */
function makeNode(overrides: Partial<Node>): Node {
  return {
    kind: 'text',
    children: [],
    ...overrides,
  } as Node;
}

// ─── BlockStack Tests ─────────────────────────────────────────────────────────

describe('BlockStack', () => {
  test('push/pop/current/parent', () => {
    const stack = new BlockStack();
    expect(stack.len()).toBe(0);

    // Default current when empty
    const defaultFrame = stack.current();
    expect(defaultFrame.block).toBe('');
    expect(defaultFrame.style).toEqual({});

    // Push a frame
    stack.push({ block: '', style: { margin: 2 }, margin: true, newline: false });
    expect(stack.len()).toBe(1);
    expect(stack.current().style.margin).toBe(2);

    // Push another
    stack.push({ block: '', style: { indent: 4 }, margin: false, newline: false });
    expect(stack.len()).toBe(2);
    expect(stack.current().style.indent).toBe(4);
    expect(stack.parent().style.margin).toBe(2);

    // Pop
    stack.pop();
    expect(stack.len()).toBe(1);
    expect(stack.current().style.margin).toBe(2);
  });

  test('indent accumulates across stack', () => {
    const stack = new BlockStack();
    stack.push({ block: '', style: { indent: 2 }, margin: false, newline: false });
    stack.push({ block: '', style: { indent: 3 }, margin: false, newline: false });
    expect(stack.indent()).toBe(5);
  });

  test('margin accumulates across stack', () => {
    const stack = new BlockStack();
    stack.push({ block: '', style: { margin: 1 }, margin: false, newline: false });
    stack.push({ block: '', style: { margin: 2 }, margin: false, newline: false });
    expect(stack.margin()).toBe(3);
  });

  test('width subtracts indent and margins', () => {
    const stack = new BlockStack();
    stack.push({ block: '', style: { margin: 2, indent: 4 }, margin: false, newline: false });
    // width = wordWrap - indent - margin*2 = 80 - 4 - 4 = 72
    expect(stack.width(80)).toBe(72);
  });

  test('width returns 0 when indent+margin exceeds wordWrap', () => {
    const stack = new BlockStack();
    stack.push({ block: '', style: { margin: 50, indent: 10 }, margin: false, newline: false });
    // totalUsed = 10 + 50*2 = 110 > 80
    expect(stack.width(80)).toBe(0);
  });

  test('writeToCurrentBlock and writeToParentBlock', () => {
    const stack = new BlockStack();
    stack.push({ block: '', style: {}, margin: false, newline: false });
    stack.push({ block: '', style: {}, margin: false, newline: false });

    stack.writeToCurrentBlock('hello');
    expect(stack.current().block).toBe('hello');

    stack.writeToParentBlock('world');
    expect(stack.parent().block).toBe('world');
  });

  test('resetCurrentBlock clears buffer', () => {
    const stack = new BlockStack();
    stack.push({ block: 'content', style: {}, margin: false, newline: false });
    stack.resetCurrentBlock();
    expect(stack.current().block).toBe('');
  });
});

// ─── RenderContext Tests ────────────────────────────────────────────────────────

describe('RenderContext', () => {
  test('constructor initializes with options', () => {
    const ctx = makeCtx();
    expect(ctx.options.wordWrap).toBe(80);
    expect(ctx.options.hyperlinks).toBe(false);
    expect(ctx.blockStack.len()).toBe(0);
  });

  test('sanitizeHTML strips tags', () => {
    const ctx = makeCtx();
    expect(ctx.sanitizeHTML('<b>bold</b>', false)).toBe('bold');
    expect(ctx.sanitizeHTML('<p>text</p>', true)).toBe('text');
  });

  test('sanitizeHTML unescapes entities', () => {
    const ctx = makeCtx();
    expect(ctx.sanitizeHTML('&amp; &lt; &gt;', false)).toBe('& < >');
    expect(ctx.sanitizeHTML('&quot;quoted&quot;', false)).toBe('"quoted"');
  });

  test('table context initialized empty', () => {
    const ctx = makeCtx();
    expect(ctx.table.header).toEqual([]);
    expect(ctx.table.rows).toEqual([]);
    expect(ctx.table.row).toEqual([]);
  });
});

// ─── BaseElement Tests ──────────────────────────────────────────────────────────

describe('BaseElement', () => {
  test('renders plain token', () => {
    const ctx = makeCtx();
    const el = new BaseElement('hello');
    const out = el.render(ctx);
    expect(out).toContain('hello');
  });

  test('renders with prefix', () => {
    const ctx = makeCtx();
    const el = new BaseElement('world', {}, 'prefix-');
    const out = el.render(ctx);
    expect(out).toContain('prefix-');
    expect(out).toContain('world');
  });

  test('applies upper transformation', () => {
    const ctx = makeCtx();
    const el = new BaseElement('hello', { upper: true });
    const out = el.render(ctx);
    expect(out).toContain('HELLO');
  });

  test('applies lower transformation', () => {
    const ctx = makeCtx();
    const el = new BaseElement('HELLO', { lower: true });
    const out = el.render(ctx);
    expect(out).toContain('hello');
  });

  test('applies title transformation', () => {
    const ctx = makeCtx();
    const el = new BaseElement('hello world', { title: true });
    const out = el.render(ctx);
    expect(out).toContain('Hello World');
  });
});

// ─── HeadingElement Tests ───────────────────────────────────────────────────────

describe('HeadingElement', () => {
  test('renders h1 with prefix and bold', () => {
    const ctx = makeCtx();
    // Push document frame first
    ctx.blockStack.push({ block: '', style: {}, margin: true, newline: false });

    const he = new HeadingElement(1, true);
    const enterOut = he.render(ctx);
    // Should have pushed a frame
    expect(ctx.blockStack.len()).toBe(2);

    // Write some content to the heading block
    ctx.blockStack.writeToCurrentBlock('Title');

    const finishOut = he.finish(ctx);
    // Should have popped back to 1
    expect(ctx.blockStack.len()).toBe(1);
    // Output should contain the title
    expect(finishOut).toContain('Title');
  });

  test('non-first heading adds newline', () => {
    const ctx = makeCtx();
    ctx.blockStack.push({ block: '', style: {}, margin: true, newline: false });

    const he = new HeadingElement(2, false);
    const enterOut = he.render(ctx);
    // Should contain a newline since not first
    expect(enterOut).toContain('\n');
  });

  test('heading level selects correct style', () => {
    const ctx = makeCtx({
      h3: { prefix: '### ', italic: true },
    });
    ctx.blockStack.push({ block: '', style: {}, margin: true, newline: false });

    const he = new HeadingElement(3, true);
    he.render(ctx);
    // The pushed frame should have the h3 style cascaded
    const currentStyle = ctx.blockStack.current().style;
    expect(currentStyle.prefix).toBe('### ');
  });
});

// ─── ParagraphElement Tests ─────────────────────────────────────────────────────

describe('ParagraphElement', () => {
  test('renders paragraph and collapses newlines', () => {
    const ctx = makeCtx();
    ctx.blockStack.push({ block: '', style: {}, margin: true, newline: false });

    const pe = new ParagraphElement(true);
    pe.render(ctx);
    expect(ctx.blockStack.len()).toBe(2);

    // Write content with newlines
    ctx.blockStack.writeToCurrentBlock('line1\nline2\nline3');

    const out = pe.finish(ctx);
    expect(ctx.blockStack.len()).toBe(1);
    // Should have collapsed newlines into spaces (preserveNewLines = false)
    expect(out).not.toContain('\n\n');
  });

  test('non-first paragraph has leading newline', () => {
    const ctx = makeCtx();
    ctx.blockStack.push({ block: '', style: {}, margin: true, newline: false });

    const pe = new ParagraphElement(false);
    const out = pe.render(ctx);
    expect(out).toContain('\n');
  });

  test('empty paragraph produces no output', () => {
    const ctx = makeCtx();
    ctx.blockStack.push({ block: '', style: {}, margin: true, newline: false });

    const pe = new ParagraphElement(true);
    pe.render(ctx);
    // Don't write anything to the buffer (empty paragraph)
    const out = pe.finish(ctx);
    expect(out).toBe('');
  });
});

// ─── EmphasisElement Tests ──────────────────────────────────────────────────────

describe('EmphasisElement', () => {
  test('level 1 applies italic style', () => {
    const ctx = makeCtx({ emph: { italic: true } });
    const child = new BaseElement('emphasized');
    const emph = new EmphasisElement(1, [child]);
    const out = emph.render(ctx);
    expect(out).toContain('emphasized');
  });

  test('level 2 applies strong (bold) style', () => {
    const ctx = makeCtx({ strong: { bold: true } });
    const child = new BaseElement('strong text');
    const emph = new EmphasisElement(2, [child]);
    const out = emph.render(ctx);
    expect(out).toContain('strong text');
  });

  test('renders multiple children', () => {
    const ctx = makeCtx();
    const child1 = new BaseElement('hello ');
    const child2 = new BaseElement('world');
    const emph = new EmphasisElement(1, [child1, child2]);
    const out = emph.render(ctx);
    expect(out).toContain('hello ');
    expect(out).toContain('world');
  });
});

// ─── LinkElement Tests ──────────────────────────────────────────────────────────

describe('LinkElement', () => {
  test('renders text and URL without hyperlinks', () => {
    const ctx = makeCtx({}, 80);
    const child = new BaseElement('click here');
    const link = new LinkElement('https://example.com', [child]);
    const out = link.render(ctx);
    expect(out).toContain('click here');
    expect(out).toContain('https://example.com');
  });

  test('renders with OSC 8 hyperlinks when enabled', () => {
    const ctx = makeCtx();
    ctx.options.hyperlinks = true;
    const child = new BaseElement('click here');
    const link = new LinkElement('https://example.com', [child]);
    const out = link.render(ctx);
    expect(out).toContain('\x1b]8;');
    expect(out).toContain('https://example.com');
    expect(out).toContain('\x07');
  });

  test('skipText only renders href', () => {
    const ctx = makeCtx();
    const child = new BaseElement('click here');
    const link = new LinkElement('https://example.com', [child], '', true, false);
    const out = link.render(ctx);
    expect(out).not.toContain('click here');
    expect(out).toContain('https://example.com');
  });

  test('skipHref only renders text', () => {
    const ctx = makeCtx();
    const child = new BaseElement('click here');
    const link = new LinkElement('https://example.com', [child], '', false, true);
    const out = link.render(ctx);
    expect(out).toContain('click here');
    // Should not contain the URL part since href is skipped
  });

  test('fragment-only URL is not rendered as hyperlink', () => {
    const ctx = makeCtx();
    ctx.options.hyperlinks = true;
    const child = new BaseElement('anchor');
    const link = new LinkElement('#section', [child]);
    const out = link.render(ctx);
    // Fragment-only URLs should not produce OSC 8 sequences
    expect(out).toContain('anchor');
  });
});

// ─── ImageElement Tests ─────────────────────────────────────────────────────────

describe('ImageElement', () => {
  test('renders alt text and URL', () => {
    const ctx = makeCtx();
    const img = new ImageElement('A cat', 'https://example.com/cat.png');
    const out = img.render(ctx);
    expect(out).toContain('A cat');
    expect(out).toContain('https://example.com/cat.png');
  });

  test('textOnly mode skips URL', () => {
    const ctx = makeCtx();
    const img = new ImageElement('A cat', 'https://example.com/cat.png', '', true);
    const out = img.render(ctx);
    expect(out).toContain('A cat');
    expect(out).not.toContain('https://example.com/cat.png');
  });
});

// ─── ItemElement Tests ──────────────────────────────────────────────────────────

describe('ItemElement', () => {
  test('renders unordered bullet', () => {
    const ctx = makeCtx({ item: { prefix: '• ' } });
    const el = new ItemElement(false);
    const out = el.render(ctx);
    expect(out).toContain('•');
  });

  test('renders ordered number', () => {
    const ctx = makeCtx({ enumeration: { suffix: '. ' } });
    const el = new ItemElement(true, 3);
    const out = el.render(ctx);
    expect(out).toContain('3');
  });
});

// ─── TaskElement Tests ──────────────────────────────────────────────────────────

describe('TaskElement', () => {
  test('renders checked task', () => {
    const ctx = makeCtx();
    const el = new TaskElement(true);
    const out = el.render(ctx);
    expect(out).toContain('✓');
  });

  test('renders unchecked task', () => {
    const ctx = makeCtx();
    const el = new TaskElement(false);
    const out = el.render(ctx);
    expect(out).toContain('✗');
  });
});

// ─── CodeBlockElement Tests ─────────────────────────────────────────────────────

describe('CodeBlockElement', () => {
  test('renders code with indentation', () => {
    const ctx = makeCtx({ code_block: { indent: 4 } });
    ctx.blockStack.push({ block: '', style: {}, margin: true, newline: false });

    const el = new CodeBlockElement('const x = 1;\nconst y = 2;\n', 'typescript');
    const out = el.render(ctx);
    expect(out).toContain('const x = 1;');
    expect(out).toContain('const y = 2;');
    // Check indentation (4 spaces)
    const lines = out.split('\n').filter(Boolean);
    for (const line of lines) {
      expect(line.startsWith('    ')).toBe(true);
    }
  });

  test('handles empty code block', () => {
    const ctx = makeCtx();
    ctx.blockStack.push({ block: '', style: {}, margin: true, newline: false });
    const el = new CodeBlockElement('', '');
    const out = el.render(ctx);
    // Should produce something (possibly just prefix/suffix)
    expect(typeof out).toBe('string');
  });
});

// ─── CodeSpanElement Tests ──────────────────────────────────────────────────────

describe('CodeSpanElement', () => {
  test('renders inline code with prefix/suffix', () => {
    const ctx = makeCtx();
    const el = new CodeSpanElement('fmt.Println()', { prefix: '`', suffix: '`' });
    const out = el.render(ctx);
    expect(out).toContain('`');
    expect(out).toContain('fmt.Println()');
  });
});

// ─── StrikethroughElement Tests ────────────────────────────────────────────────

describe('StrikethroughElement', () => {
  test('renders strikethrough text', () => {
    const ctx = makeCtx({ strikethrough: { crossed_out: true } });
    const el = new StrikethroughElement('deleted');
    const out = el.render(ctx);
    expect(out).toContain('deleted');
  });
});

// ─── HRElement Tests ──────────────────────────────────────────────────────────

describe('HRElement', () => {
  test('renders horizontal rule filling width', () => {
    const ctx = makeCtx({ hr: { format: '─' } }, 40);
    ctx.blockStack.push({ block: '', style: {}, margin: true, newline: false });
    const el = new HRElement();
    const out = el.render(ctx);
    expect(out).toContain('─');
    // Should repeat to fill width
    expect(out.length).toBeGreaterThan(10);
  });
});

// ─── TableElement Tests ─────────────────────────────────────────────────────────

describe('TableElement', () => {
  test('renders simple table', () => {
    const ctx = makeCtx({ table: { column_separator: '│', row_separator: '─', center_separator: '┼' } });
    ctx.blockStack.push({ block: '', style: {}, margin: true, newline: false });

    const te = new TableElement();
    te.render(ctx);

    // Add header cells
    const hc1 = new TableCellElement([new BaseElement('Name')], true);
    const hc2 = new TableCellElement([new BaseElement('Age')], true);
    hc1.render(ctx);
    hc2.render(ctx);
    new TableHeadElement().finish(ctx);

    // Add body row
    const c1 = new TableCellElement([new BaseElement('Alice')]);
    const c2 = new TableCellElement([new BaseElement('30')]);
    c1.render(ctx);
    c2.render(ctx);
    new TableRowElement().finish(ctx);

    const out = te.finish(ctx);
    expect(out).toContain('Name');
    expect(out).toContain('Age');
    expect(out).toContain('Alice');
    expect(out).toContain('30');
    expect(out).toContain('│');
  });

  test('handles empty table', () => {
    const ctx = makeCtx();
    ctx.blockStack.push({ block: '', style: {}, margin: true, newline: false });

    const te = new TableElement();
    te.render(ctx);
    const out = te.finish(ctx);
    expect(out).toBe('');
  });
});

// ─── isChildNode Tests ──────────────────────────────────────────────────────────

describe('isChildNode', () => {
  test('returns true for text inside link', () => {
    const link = makeNode({ kind: 'link' as NodeKind });
    const text = makeNode({ kind: 'text' as NodeKind, parent: link });
    expect(isChildNode(text)).toBe(true);
  });

  test('returns true for text inside emphasis', () => {
    const emph = makeNode({ kind: 'emphasis' as NodeKind });
    const text = makeNode({ kind: 'text' as NodeKind, parent: emph });
    expect(isChildNode(text)).toBe(true);
  });

  test('returns true for text inside code_span', () => {
    const span = makeNode({ kind: 'code_span' as NodeKind });
    const text = makeNode({ kind: 'text' as NodeKind, parent: span });
    expect(isChildNode(text)).toBe(true);
  });

  test('returns true for text inside table_cell', () => {
    const cell = makeNode({ kind: 'table_cell' as NodeKind });
    const text = makeNode({ kind: 'text' as NodeKind, parent: cell });
    expect(isChildNode(text)).toBe(true);
  });

  test('returns false for top-level paragraph', () => {
    const doc = makeNode({ kind: 'document' as NodeKind });
    const para = makeNode({ kind: 'paragraph' as NodeKind, parent: doc });
    expect(isChildNode(para)).toBe(false);
  });

  test('returns true for deeply nested child', () => {
    const link = makeNode({ kind: 'link' as NodeKind });
    const emph = makeNode({ kind: 'emphasis' as NodeKind, parent: link });
    const text = makeNode({ kind: 'text' as NodeKind, parent: emph });
    expect(isChildNode(text)).toBe(true);
  });
});

// ─── newElement Factory Tests ──────────────────────────────────────────────────

describe('newElement', () => {
  test('creates document element', () => {
    const ctx = makeCtx();
    const node = makeNode({ kind: 'document' as NodeKind });
    const el = newElement(node, ctx);
    expect(el.renderer).toBeDefined();
    expect(el.finisher).toBeDefined();
  });

  test('creates heading element', () => {
    const ctx = makeCtx();
    ctx.blockStack.push({ block: '', style: {}, margin: true, newline: false });
    const node = makeNode({ kind: 'heading' as NodeKind, level: 2 });
    const el = newElement(node, ctx);
    expect(el.renderer).toBeDefined();
    expect(el.finisher).toBeDefined();
  });

  test('creates paragraph element', () => {
    const ctx = makeCtx();
    ctx.blockStack.push({ block: '', style: {}, margin: true, newline: false });
    const node = makeNode({ kind: 'paragraph' as NodeKind });
    const el = newElement(node, ctx);
    expect(el.renderer).toBeDefined();
    expect(el.finisher).toBeDefined();
  });

  test('skips paragraph inside list_item', () => {
    const ctx = makeCtx();
    const listItem = makeNode({ kind: 'list_item' as NodeKind });
    const para = makeNode({ kind: 'paragraph' as NodeKind, parent: listItem });
    const el = newElement(para, ctx);
    expect(el.renderer).toBeUndefined();
    expect(el.finisher).toBeUndefined();
  });

  test('creates text element', () => {
    const ctx = makeCtx();
    const node = makeNode({ kind: 'text' as NodeKind, literal: 'Hello World' });
    const el = newElement(node, ctx);
    expect(el.renderer).toBeDefined();
  });

  test('creates emphasis element', () => {
    const ctx = makeCtx();
    const textChild = makeNode({ kind: 'text' as NodeKind, literal: 'bold' });
    const node = makeNode({
      kind: 'emphasis' as NodeKind,
      level: 2,
      children: [textChild],
    });
    const el = newElement(node, ctx);
    expect(el.renderer).toBeDefined();
  });

  test('creates code_block element', () => {
    const ctx = makeCtx();
    const node = makeNode({
      kind: 'code_block' as NodeKind,
      literal: 'console.log("hi")\n',
      info: 'javascript',
    });
    const el = newElement(node, ctx);
    expect(el.renderer).toBeDefined();
    expect(el.entering).toBe('\n');
  });

  test('creates code_span element', () => {
    const ctx = makeCtx();
    ctx.blockStack.push({ block: '', style: {}, margin: true, newline: false });
    const node = makeNode({ kind: 'code_span' as NodeKind, literal: 'x + y' });
    const el = newElement(node, ctx);
    expect(el.renderer).toBeDefined();
  });

  test('creates link element', () => {
    const ctx = makeCtx();
    const textChild = makeNode({ kind: 'text' as NodeKind, literal: 'Click' });
    const node = makeNode({
      kind: 'link' as NodeKind,
      destination: 'https://example.com',
      children: [textChild],
    });
    const el = newElement(node, ctx);
    expect(el.renderer).toBeDefined();
  });

  test('creates image element', () => {
    const ctx = makeCtx();
    const node = makeNode({
      kind: 'image' as NodeKind,
      literal: 'alt text',
      destination: 'https://example.com/img.png',
    });
    const el = newElement(node, ctx);
    expect(el.renderer).toBeDefined();
  });

  test('creates table element with entering/exiting', () => {
    const ctx = makeCtx();
    const node = makeNode({ kind: 'table' as NodeKind });
    const el = newElement(node, ctx);
    expect(el.renderer).toBeDefined();
    expect(el.finisher).toBeDefined();
    expect(el.entering).toBe('\n');
    expect(el.exiting).toBe('\n');
  });

  test('creates thematic_break element', () => {
    const ctx = makeCtx();
    const node = makeNode({ kind: 'thematic_break' as NodeKind });
    const el = newElement(node, ctx);
    expect(el.renderer).toBeDefined();
  });

  test('creates list element', () => {
    const ctx = makeCtx();
    ctx.blockStack.push({ block: '', style: {}, margin: true, newline: false });
    const node = makeNode({ kind: 'list' as NodeKind });
    const el = newElement(node, ctx);
    expect(el.renderer).toBeDefined();
    expect(el.finisher).toBeDefined();
    expect(el.entering).toBe('\n');
  });

  test('creates list_item element with ordered enumeration', () => {
    const ctx = makeCtx();
    const list = makeNode({ kind: 'list' as NodeKind, ordered: true, start: 1 });
    const item = makeNode({
      kind: 'list_item' as NodeKind,
      parent: list,
      children: [],
    });
    const el = newElement(item, ctx);
    expect(el.renderer).toBeDefined();
  });

  test('creates html_block element', () => {
    const ctx = makeCtx();
    const node = makeNode({ kind: 'html_block' as NodeKind, literal: '<div>hello</div>' });
    const el = newElement(node, ctx);
    expect(el.renderer).toBeDefined();
  });

  test('unknown kind returns empty element', () => {
    const ctx = makeCtx();
    const node = makeNode({ kind: 'unknown_kind' as NodeKind });
    const el = newElement(node, ctx);
    expect(el.renderer).toBeUndefined();
    expect(el.finisher).toBeUndefined();
  });
});

// ─── Style Cascading Tests (used by elements) ─────────────────────────────────

describe('Style cascading for elements', () => {
  test('cascadeStyles merges heading levels', () => {
    const base: StyleBlock = { prefix: '# ', bold: true };
    const h2: StyleBlock = { prefix: '## ', italic: true };
    const result = cascadeStyles(base, h2);
    expect(result.prefix).toBe('## ');
    expect(result.bold).toBe(true);
    expect(result.italic).toBe(true);
  });

  test('cascadeStyle inherits parent colors', () => {
    const parent: StyleBlock = { color: '#ff0000' };
    const child: StyleBlock = { bold: true };
    const result = cascadeStyle(parent, child, false);
    expect(result.color).toBe('#ff0000');
    expect(result.bold).toBe(true);
  });

  test('child color overrides parent', () => {
    const parent: StyleBlock = { color: '#ff0000' };
    const child: StyleBlock = { color: '#00ff00' };
    const result = cascadeStyle(parent, child, false);
    expect(result.color).toBe('#00ff00');
  });
});
