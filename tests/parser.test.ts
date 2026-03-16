import { describe, test, expect } from 'bun:test';
import { parse, NodeKind } from '../src/parser.js';
import type { Node } from '../src/parser.js';

// Helpers
function findByKind(node: Node, kind: string): Node | undefined {
  if (node.kind === kind) return node;
  for (const child of node.children) {
    const found = findByKind(child, kind);
    if (found) return found;
  }
  return undefined;
}

function findAllByKind(node: Node, kind: string): Node[] {
  const results: Node[] = [];
  if (node.kind === kind) results.push(node);
  for (const child of node.children) {
    results.push(...findAllByKind(child, kind));
  }
  return results;
}

function getTextContent(node: Node): string {
  let text = '';
  if (node.literal !== undefined) text += node.literal;
  for (const child of node.children) {
    text += getTextContent(child);
  }
  return text;
}

// ─── Block Parsing ──────────────────────────────────────────────────────────

describe('parser - block parsing', () => {
  test('empty document', () => {
    const root = parse('');
    expect(root.kind).toBe('document');
    expect(root.children.length).toBe(0);
  });

  test('whitespace only', () => {
    const root = parse('   \n  \n   ');
    expect(root.kind).toBe('document');
    expect(root.children.length).toBe(0);
  });

  test('single paragraph', () => {
    const root = parse('Hello world');
    expect(root.children.length).toBe(1);
    expect(root.children[0].kind).toBe('paragraph');
    expect(getTextContent(root.children[0])).toBe('Hello world');
  });

  test('two paragraphs separated by blank line', () => {
    const root = parse('First paragraph\n\nSecond paragraph');
    expect(root.children.length).toBe(2);
    expect(root.children[0].kind).toBe('paragraph');
    expect(root.children[1].kind).toBe('paragraph');
    expect(getTextContent(root.children[0])).toBe('First paragraph');
    expect(getTextContent(root.children[1])).toBe('Second paragraph');
  });

  test('ATX headings h1 through h6', () => {
    const md = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6';
    const root = parse(md);
    const headings = findAllByKind(root, 'heading');
    expect(headings.length).toBe(6);
    for (let i = 0; i < 6; i++) {
      expect(headings[i].level).toBe(i + 1);
      expect(getTextContent(headings[i])).toBe(`H${i + 1}`);
    }
  });

  test('ATX heading with trailing hashes', () => {
    const root = parse('## Heading ##');
    const h = findByKind(root, 'heading')!;
    expect(h.level).toBe(2);
    expect(getTextContent(h)).toBe('Heading');
  });

  test('setext heading h1', () => {
    const root = parse('Heading\n=======');
    const h = findByKind(root, 'heading')!;
    expect(h.level).toBe(1);
    expect(getTextContent(h)).toBe('Heading');
  });

  test('setext heading h2', () => {
    const root = parse('Heading\n-------');
    const h = findByKind(root, 'heading')!;
    expect(h.level).toBe(2);
    expect(getTextContent(h)).toBe('Heading');
  });

  test('thematic break ---', () => {
    const root = parse('---');
    expect(root.children[0].kind).toBe('thematic_break');
  });

  test('thematic break ***', () => {
    const root = parse('***');
    expect(root.children[0].kind).toBe('thematic_break');
  });

  test('thematic break ___', () => {
    const root = parse('___');
    expect(root.children[0].kind).toBe('thematic_break');
  });

  test('thematic break with spaces', () => {
    const root = parse('- - -');
    expect(root.children[0].kind).toBe('thematic_break');
  });

  test('fenced code block with language', () => {
    const md = '```typescript\nconst x = 1;\nconst y = 2;\n```';
    const root = parse(md);
    const cb = findByKind(root, 'fenced_code_block')!;
    expect(cb.info).toBe('typescript');
    expect(cb.literal).toContain('const x = 1;');
    expect(cb.literal).toContain('const y = 2;');
  });

  test('fenced code block without language', () => {
    const md = '```\nsome code\n```';
    const root = parse(md);
    const cb = findByKind(root, 'fenced_code_block')!;
    expect(cb.info).toBeUndefined();
    expect(cb.literal).toContain('some code');
  });

  test('fenced code block with tildes', () => {
    const md = '~~~js\nalert("hi")\n~~~';
    const root = parse(md);
    const cb = findByKind(root, 'fenced_code_block')!;
    expect(cb.info).toBe('js');
  });

  test('indented code block', () => {
    const md = '    line 1\n    line 2';
    const root = parse(md);
    const cb = findByKind(root, 'code_block')!;
    expect(cb.literal).toContain('line 1');
    expect(cb.literal).toContain('line 2');
  });

  test('block quote', () => {
    const md = '> quoted text\n> more text';
    const root = parse(md);
    const bq = findByKind(root, 'block_quote')!;
    expect(bq).toBeTruthy();
    const para = findByKind(bq, 'paragraph')!;
    expect(getTextContent(para)).toContain('quoted text');
  });

  test('nested block quotes', () => {
    const md = '> outer\n> > inner';
    const root = parse(md);
    const bqs = findAllByKind(root, 'block_quote');
    expect(bqs.length).toBe(2);
  });

  test('unordered list', () => {
    const md = '- item 1\n- item 2\n- item 3';
    const root = parse(md);
    const list = findByKind(root, 'list')!;
    expect(list.ordered).toBe(false);
    const items = findAllByKind(list, 'list_item');
    expect(items.length).toBe(3);
  });

  test('ordered list', () => {
    const md = '1. first\n2. second\n3. third';
    const root = parse(md);
    const list = findByKind(root, 'list')!;
    expect(list.ordered).toBe(true);
    expect(list.start).toBe(1);
    const items = findAllByKind(list, 'list_item');
    expect(items.length).toBe(3);
  });

  test('ordered list with custom start', () => {
    const md = '5. fifth\n6. sixth';
    const root = parse(md);
    const list = findByKind(root, 'list')!;
    expect(list.ordered).toBe(true);
    expect(list.start).toBe(5);
  });

  test('HTML block', () => {
    const md = '<div>\nsome content\n</div>';
    const root = parse(md);
    const htmlBlock = findByKind(root, 'html_block')!;
    expect(htmlBlock.literal).toContain('<div>');
  });

  test('GFM table', () => {
    const md = '| A | B | C |\n|---|:---:|---:|\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |';
    const root = parse(md);
    const table = findByKind(root, 'table')!;
    expect(table).toBeTruthy();
    expect(table.alignments).toEqual(['none', 'center', 'right']);

    const header = findByKind(table, 'table_header')!;
    expect(header).toBeTruthy();

    const rows = findAllByKind(table, 'table_row');
    expect(rows.length).toBe(3); // 1 header row + 2 data rows

    const cells = findAllByKind(table, 'table_cell');
    expect(cells.length).toBe(9); // 3 columns * 3 rows
  });

  test('task list items', () => {
    const md = '- [ ] unchecked\n- [x] checked\n- [X] also checked';
    const root = parse(md);
    const checkboxes = findAllByKind(root, 'task_checkbox');
    expect(checkboxes.length).toBe(3);
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(true);
    expect(checkboxes[2].checked).toBe(true);
  });
});

// ─── Inline Parsing ─────────────────────────────────────────────────────────

describe('parser - inline parsing', () => {
  test('emphasis with asterisks', () => {
    const root = parse('*italic*');
    const em = findByKind(root, 'emphasis')!;
    expect(em).toBeTruthy();
    expect(em.level).toBe(1);
    expect(getTextContent(em)).toBe('italic');
  });

  test('emphasis with underscores', () => {
    const root = parse('_italic_');
    const em = findByKind(root, 'emphasis')!;
    expect(em).toBeTruthy();
    expect(em.level).toBe(1);
  });

  test('strong with double asterisks', () => {
    const root = parse('**bold**');
    const em = findByKind(root, 'emphasis')!;
    expect(em).toBeTruthy();
    expect(em.level).toBe(2);
    expect(getTextContent(em)).toBe('bold');
  });

  test('strong with double underscores', () => {
    const root = parse('__bold__');
    const em = findByKind(root, 'emphasis')!;
    expect(em.level).toBe(2);
  });

  test('strikethrough', () => {
    const root = parse('~~deleted~~');
    const st = findByKind(root, 'strikethrough')!;
    expect(st).toBeTruthy();
    expect(getTextContent(st)).toBe('deleted');
  });

  test('inline code', () => {
    const root = parse('Use `console.log()` here');
    const cs = findByKind(root, 'code_span')!;
    expect(cs).toBeTruthy();
    expect(cs.literal).toBe('console.log()');
  });

  test('inline code with double backticks', () => {
    const root = parse('`` code with `backtick` ``');
    const cs = findByKind(root, 'code_span')!;
    expect(cs.literal).toBe('code with `backtick`');
  });

  test('link', () => {
    const root = parse('[text](https://example.com "Title")');
    const link = findByKind(root, 'link')!;
    expect(link).toBeTruthy();
    expect(link.destination).toBe('https://example.com');
    expect(link.title).toBe('Title');
    expect(getTextContent(link)).toBe('text');
  });

  test('link without title', () => {
    const root = parse('[text](https://example.com)');
    const link = findByKind(root, 'link')!;
    expect(link.destination).toBe('https://example.com');
    expect(link.title).toBeUndefined();
  });

  test('image', () => {
    const root = parse('![alt text](https://example.com/img.png "Title")');
    const img = findByKind(root, 'image')!;
    expect(img).toBeTruthy();
    expect(img.destination).toBe('https://example.com/img.png');
    expect(img.title).toBe('Title');
  });

  test('autolink URL', () => {
    const root = parse('<https://example.com>');
    const al = findByKind(root, 'auto_link')!;
    expect(al).toBeTruthy();
    expect(al.destination).toBe('https://example.com');
  });

  test('autolink email', () => {
    const root = parse('<user@example.com>');
    const al = findByKind(root, 'auto_link')!;
    expect(al.destination).toBe('mailto:user@example.com');
  });

  test('hard line break with spaces', () => {
    const root = parse('line one  \nline two');
    const hb = findByKind(root, 'hardbreak')!;
    expect(hb).toBeTruthy();
  });

  test('hard line break with backslash', () => {
    const root = parse('line one\\\nline two');
    const hb = findByKind(root, 'hardbreak')!;
    expect(hb).toBeTruthy();
  });

  test('soft line break', () => {
    const root = parse('line one\nline two');
    const sb = findByKind(root, 'softbreak')!;
    expect(sb).toBeTruthy();
  });

  test('backslash escape', () => {
    const root = parse('\\*not italic\\*');
    const para = findByKind(root, 'paragraph')!;
    expect(getTextContent(para)).toBe('*not italic*');
    expect(findByKind(root, 'emphasis')).toBeUndefined();
  });

  test('HTML entity - named', () => {
    const root = parse('&amp; &lt; &gt;');
    const para = findByKind(root, 'paragraph')!;
    expect(getTextContent(para)).toBe('& < >');
  });

  test('HTML entity - numeric', () => {
    const root = parse('&#65; &#x41;');
    const para = findByKind(root, 'paragraph')!;
    expect(getTextContent(para)).toBe('A A');
  });

  test('inline HTML', () => {
    const root = parse('text <em>emphasized</em> text');
    const hi = findByKind(root, 'html_inline')!;
    expect(hi).toBeTruthy();
    expect(hi.literal).toBe('<em>');
  });
});

// ─── Nesting ────────────────────────────────────────────────────────────────

describe('parser - nesting', () => {
  test('blockquote containing paragraph', () => {
    const root = parse('> Hello world');
    const bq = findByKind(root, 'block_quote')!;
    const para = findByKind(bq, 'paragraph')!;
    expect(para).toBeTruthy();
    expect(getTextContent(para)).toBe('Hello world');
  });

  test('blockquote containing list', () => {
    const md = '> - item 1\n> - item 2';
    const root = parse(md);
    const bq = findByKind(root, 'block_quote')!;
    const list = findByKind(bq, 'list')!;
    expect(list).toBeTruthy();
    expect(list.ordered).toBe(false);
  });

  test('nested emphasis', () => {
    const root = parse('**bold and *italic***');
    const strong = findByKind(root, 'emphasis')!;
    expect(strong.level).toBe(2);
  });

  test('emphasis inside link', () => {
    const root = parse('[**bold** link](https://example.com)');
    const link = findByKind(root, 'link')!;
    expect(link).toBeTruthy();
    const em = findByKind(link, 'emphasis')!;
    expect(em).toBeTruthy();
    expect(em.level).toBe(2);
  });

  test('code span inside emphasis', () => {
    const root = parse('*`code` in italic*');
    const em = findByKind(root, 'emphasis')!;
    expect(em).toBeTruthy();
    const cs = findByKind(em, 'code_span')!;
    expect(cs).toBeTruthy();
    expect(cs.literal).toBe('code');
  });
});

// ─── Sibling and Parent References ──────────────────────────────────────────

describe('parser - tree structure', () => {
  test('root has no parent or siblings', () => {
    const root = parse('hello');
    expect(root.parent).toBeNull();
    expect(root.prevSibling).toBeNull();
    expect(root.nextSibling).toBeNull();
  });

  test('children have parent reference', () => {
    const root = parse('# Heading\n\nParagraph');
    for (const child of root.children) {
      expect(child.parent).toBe(root);
    }
  });

  test('siblings are linked', () => {
    const root = parse('# H1\n\n## H2\n\n### H3');
    expect(root.children.length).toBe(3);
    expect(root.children[0].prevSibling).toBeNull();
    expect(root.children[0].nextSibling).toBe(root.children[1]);
    expect(root.children[1].prevSibling).toBe(root.children[0]);
    expect(root.children[1].nextSibling).toBe(root.children[2]);
    expect(root.children[2].prevSibling).toBe(root.children[1]);
    expect(root.children[2].nextSibling).toBeNull();
  });

  test('list item siblings', () => {
    const root = parse('- a\n- b\n- c');
    const list = findByKind(root, 'list')!;
    const items = list.children.filter(c => c.kind === 'list_item');
    expect(items.length).toBe(3);
    expect(items[0].nextSibling).toBe(items[1]);
    expect(items[1].prevSibling).toBe(items[0]);
    expect(items[1].nextSibling).toBe(items[2]);
    expect(items[2].prevSibling).toBe(items[1]);
  });

  test('inline children have parent reference', () => {
    const root = parse('Hello **world**');
    const para = findByKind(root, 'paragraph')!;
    for (const child of para.children) {
      expect(child.parent).toBe(para);
    }
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe('parser - edge cases', () => {
  test('heading with no content', () => {
    const root = parse('#');
    // # without space is not a heading per CommonMark — it's a paragraph
    expect(root.children[0].kind).toBe('paragraph');
  });

  test('code block preserves content verbatim', () => {
    const md = '```\n# not a heading\n**not bold**\n```';
    const root = parse(md);
    const cb = findByKind(root, 'fenced_code_block')!;
    expect(cb.literal).toContain('# not a heading');
    expect(cb.literal).toContain('**not bold**');
    // No heading or emphasis nodes should be created
    expect(findByKind(root, 'heading')).toBeUndefined();
  });

  test('link with parens in URL', () => {
    const root = parse('[wiki](https://en.wikipedia.org/wiki/Foo_(bar))');
    const link = findByKind(root, 'link')!;
    expect(link.destination).toBe('https://en.wikipedia.org/wiki/Foo_(bar)');
  });

  test('multiple code blocks', () => {
    const md = '```js\nfoo\n```\n\n```py\nbar\n```';
    const root = parse(md);
    const blocks = findAllByKind(root, 'fenced_code_block');
    expect(blocks.length).toBe(2);
    expect(blocks[0].info).toBe('js');
    expect(blocks[1].info).toBe('py');
  });

  test('table with left-aligned columns', () => {
    const md = '| A |\n|:---|\n| 1 |';
    const root = parse(md);
    const table = findByKind(root, 'table')!;
    expect(table.alignments).toEqual(['left']);
  });

  test('deeply nested blockquote', () => {
    const md = '> > > deeply nested';
    const root = parse(md);
    const bqs = findAllByKind(root, 'block_quote');
    expect(bqs.length).toBe(3);
  });

  test('mixed content document', () => {
    const md = [
      '# Title',
      '',
      'A paragraph with **bold** and *italic*.',
      '',
      '- item 1',
      '- item 2',
      '',
      '```ts',
      'const x = 1;',
      '```',
      '',
      '> A quote',
      '',
      '---',
      '',
      '| A | B |',
      '|---|---|',
      '| 1 | 2 |',
    ].join('\n');

    const root = parse(md);
    const kinds = root.children.map(c => c.kind);
    expect(kinds).toContain('heading');
    expect(kinds).toContain('paragraph');
    expect(kinds).toContain('list');
    expect(kinds).toContain('fenced_code_block');
    expect(kinds).toContain('block_quote');
    expect(kinds).toContain('thematic_break');
    expect(kinds).toContain('table');
  });
});
