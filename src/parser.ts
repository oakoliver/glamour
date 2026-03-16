// parser.ts — Zero-dependency GFM Markdown parser for @oakoliver/glamour
// Produces an AST matching the Node interface consumed by elements.ts

// ─── Node Kind Constants ────────────────────────────────────────────────────

export const NodeKind = {
  Document: 'document',
  Heading: 'heading',
  Paragraph: 'paragraph',
  BlockQuote: 'block_quote',
  List: 'list',
  ListItem: 'list_item',
  FencedCodeBlock: 'fenced_code_block',
  CodeBlock: 'code_block',
  ThematicBreak: 'thematic_break',
  HtmlBlock: 'html_block',
  HtmlInline: 'html_inline',
  Table: 'table',
  TableHeader: 'table_header',
  TableRow: 'table_row',
  TableCell: 'table_cell',
  Text: 'text',
  Emphasis: 'emphasis',
  Strikethrough: 'strikethrough',
  Link: 'link',
  AutoLink: 'auto_link',
  Image: 'image',
  CodeSpan: 'code_span',
  HardBreak: 'hardbreak',
  SoftBreak: 'softbreak',
  TaskCheckbox: 'task_checkbox',
  TextBlock: 'text_block',
} as const;

export type NodeKindType = (typeof NodeKind)[keyof typeof NodeKind];

// ─── Node Interface ─────────────────────────────────────────────────────────

export interface Node {
  kind: string;
  children: Node[];
  parent: Node | null;
  prevSibling: Node | null;
  nextSibling: Node | null;

  // Heading
  level?: number;

  // List
  ordered?: boolean;
  start?: number;

  // FencedCodeBlock / CodeBlock
  info?: string;
  literal?: string;

  // Link / Image
  destination?: string;
  title?: string;

  // TaskCheckBox
  checked?: boolean;

  // Table
  alignments?: ('left' | 'center' | 'right' | 'none')[];

  // Text flags
  hardBreak?: boolean;
  softBreak?: boolean;
}

// ─── Node Construction Helpers ──────────────────────────────────────────────

function createNode(kind: string, parent: Node | null): Node {
  const node: Node = {
    kind,
    children: [],
    parent,
    prevSibling: null,
    nextSibling: null,
  };
  if (parent) {
    const siblings = parent.children;
    if (siblings.length > 0) {
      const prev = siblings[siblings.length - 1];
      prev.nextSibling = node;
      node.prevSibling = prev;
    }
    siblings.push(node);
  }
  return node;
}

function createTextNode(text: string, parent: Node | null): Node {
  const node = createNode(NodeKind.Text, parent);
  node.literal = text;
  return node;
}

// ─── Block Parsing Helpers ──────────────────────────────────────────────────

const ATX_HEADING_RE = /^(#{1,6})\s+(.*?)(?:\s+#+\s*)?$/;
const THEMATIC_BREAK_RE = /^(?:([-*_])[ \t]*){3,}$/;
const FENCED_CODE_OPEN_RE = /^(`{3,}|~{3,})\s*(.*)?$/;
const UNORDERED_LIST_RE = /^([-*+])\s/;
const ORDERED_LIST_RE = /^(\d{1,9})([.)]\s)/;
const BLOCKQUOTE_RE = /^>\s?/;
const TABLE_DELIM_RE = /^\|?[\s:-]+\|[\s|:-]*$/;
const TABLE_DELIM_CELL_RE = /^:?-+:?$/;
const HTML_BLOCK_RE = /^<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|pre|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i;
const HTML_COMMENT_RE = /^<!--/;
const HTML_PI_RE = /^<\?/;
const HTML_DECL_RE = /^<![A-Z]/;
const HTML_CDATA_RE = /^<!\[CDATA\[/;
const SETEXT_H1_RE = /^=+\s*$/;
const SETEXT_H2_RE = /^-+\s*$/;

function isBlankLine(line: string): boolean {
  return /^\s*$/.test(line);
}

/** Parse table delimiter row and return alignments, or null if not a valid delimiter. */
function parseTableDelimiter(line: string): ('left' | 'center' | 'right' | 'none')[] | null {
  const trimmed = line.trim();
  if (!TABLE_DELIM_RE.test(trimmed)) return null;

  // Split by pipe, strip outer empties
  let cells = trimmed.split('|');
  if (cells.length > 0 && cells[0].trim() === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop();
  if (cells.length === 0) return null;

  const alignments: ('left' | 'center' | 'right' | 'none')[] = [];
  for (const cell of cells) {
    const c = cell.trim();
    if (!TABLE_DELIM_CELL_RE.test(c)) return null;
    const left = c.startsWith(':');
    const right = c.endsWith(':');
    if (left && right) alignments.push('center');
    else if (right) alignments.push('right');
    else if (left) alignments.push('left');
    else alignments.push('none');
  }
  return alignments;
}

/** Split a table row into cell strings. */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  // Remove leading/trailing pipes
  let s = trimmed;
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);

  const cells: string[] = [];
  let current = '';
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      current += ch;
      continue;
    }
    if (ch === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

// ─── Block-level State Machine ──────────────────────────────────────────────

interface BlockParserState {
  lines: string[];
  pos: number;
  root: Node;
}

function peekLine(state: BlockParserState): string | null {
  if (state.pos >= state.lines.length) return null;
  return state.lines[state.pos];
}

function consumeLine(state: BlockParserState): string {
  return state.lines[state.pos++];
}

/** Parse all blocks under a parent node from lines[start..end). Returns nothing, mutates parent. */
function parseBlocks(lines: string[], parent: Node): void {
  let pos = 0;

  // Accumulator for paragraph text
  let paraLines: string[] = [];

  function flushParagraph(): void {
    if (paraLines.length === 0) return;
    // Check for setext heading
    // (setext only applies if paragraph is a single line followed by === or ---)
    // Actually, setext heading: the para lines form the heading content,
    // and the last consumed line before flush is the === or ---
    // We handle setext inline during line scanning instead.
    const para = createNode(NodeKind.Paragraph, parent);
    const text = paraLines.join('\n');
    parseInlines(text, para);
    paraLines = [];
  }

  while (pos < lines.length) {
    const line = lines[pos];

    // Blank line
    if (isBlankLine(line)) {
      flushParagraph();
      pos++;
      continue;
    }

    // ATX Heading
    const atxMatch = ATX_HEADING_RE.exec(line);
    if (atxMatch) {
      flushParagraph();
      const level = atxMatch[1].length;
      const content = atxMatch[2].trim();
      const heading = createNode(NodeKind.Heading, parent);
      heading.level = level;
      parseInlines(content, heading);
      pos++;
      continue;
    }

    // Thematic break (must check before setext h2 since --- matches both)
    if (THEMATIC_BREAK_RE.test(line) && paraLines.length === 0) {
      flushParagraph();
      createNode(NodeKind.ThematicBreak, parent);
      pos++;
      continue;
    }

    // Setext heading (only if we have accumulated paragraph lines)
    if (paraLines.length > 0) {
      if (SETEXT_H1_RE.test(line)) {
        const text = paraLines.join('\n');
        paraLines = [];
        const heading = createNode(NodeKind.Heading, parent);
        heading.level = 1;
        parseInlines(text, heading);
        pos++;
        continue;
      }
      if (SETEXT_H2_RE.test(line)) {
        const text = paraLines.join('\n');
        paraLines = [];
        const heading = createNode(NodeKind.Heading, parent);
        heading.level = 2;
        parseInlines(text, heading);
        pos++;
        continue;
      }
    }

    // Fenced code block
    const fenceMatch = FENCED_CODE_OPEN_RE.exec(line);
    if (fenceMatch) {
      flushParagraph();
      const fence = fenceMatch[1];
      const fenceChar = fence[0];
      const fenceLen = fence.length;
      const info = (fenceMatch[2] || '').trim();
      pos++;

      const codeLines: string[] = [];
      let closed = false;
      while (pos < lines.length) {
        const cl = lines[pos];
        const closeRe = new RegExp(`^${fenceChar}{${fenceLen},}\\s*$`);
        if (closeRe.test(cl)) {
          pos++;
          closed = true;
          break;
        }
        codeLines.push(cl);
        pos++;
      }

      const codeBlock = createNode(NodeKind.FencedCodeBlock, parent);
      codeBlock.info = info || undefined;
      codeBlock.literal = codeLines.join('\n');
      if (codeLines.length > 0) codeBlock.literal += '\n';
      continue;
    }

    // Indented code block (4 spaces, only if not in paragraph context)
    if (paraLines.length === 0 && line.length >= 4 && (line.startsWith('    ') || line.startsWith('\t'))) {
      flushParagraph();
      const codeLines: string[] = [];
      while (pos < lines.length) {
        const cl = lines[pos];
        if (cl.startsWith('    ') || cl.startsWith('\t') || isBlankLine(cl)) {
          codeLines.push(cl.startsWith('\t') ? cl.slice(1) : cl.slice(4));
          pos++;
        } else {
          break;
        }
      }
      // Trim trailing blank lines
      while (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === '') {
        codeLines.pop();
      }
      const codeBlock = createNode(NodeKind.CodeBlock, parent);
      codeBlock.literal = codeLines.join('\n');
      if (codeLines.length > 0) codeBlock.literal += '\n';
      continue;
    }

    // Block quote
    if (BLOCKQUOTE_RE.test(line)) {
      flushParagraph();
      const quoteLines: string[] = [];
      while (pos < lines.length) {
        const ql = lines[pos];
        if (BLOCKQUOTE_RE.test(ql)) {
          quoteLines.push(ql.replace(BLOCKQUOTE_RE, ''));
          pos++;
        } else if (!isBlankLine(ql) && quoteLines.length > 0 && !isBlankLine(quoteLines[quoteLines.length - 1])) {
          // Lazy continuation
          quoteLines.push(ql);
          pos++;
        } else {
          break;
        }
      }
      const bq = createNode(NodeKind.BlockQuote, parent);
      parseBlocks(quoteLines, bq);
      continue;
    }

    // Unordered list
    const ulMatch = UNORDERED_LIST_RE.exec(line);
    if (ulMatch) {
      flushParagraph();
      const marker = ulMatch[1];
      pos = parseList(lines, pos, parent, false, 0, marker);
      continue;
    }

    // Ordered list
    const olMatch = ORDERED_LIST_RE.exec(line);
    if (olMatch) {
      flushParagraph();
      const startNum = parseInt(olMatch[1], 10);
      pos = parseList(lines, pos, parent, true, startNum, '');
      continue;
    }

    // HTML block
    if (HTML_BLOCK_RE.test(line) || HTML_COMMENT_RE.test(line) || HTML_PI_RE.test(line) ||
        HTML_DECL_RE.test(line) || HTML_CDATA_RE.test(line)) {
      flushParagraph();
      const htmlLines: string[] = [line];
      pos++;
      // Consume until blank line
      while (pos < lines.length && !isBlankLine(lines[pos])) {
        htmlLines.push(lines[pos]);
        pos++;
      }
      const htmlBlock = createNode(NodeKind.HtmlBlock, parent);
      htmlBlock.literal = htmlLines.join('\n') + '\n';
      continue;
    }

    // GFM Table: check if current line + next line form header + delimiter
    if (pos + 1 < lines.length && line.includes('|')) {
      const nextLine = lines[pos + 1];
      const alignments = parseTableDelimiter(nextLine);
      if (alignments) {
        flushParagraph();
        pos = parseTable(lines, pos, parent, alignments);
        continue;
      }
    }

    // Default: paragraph continuation
    paraLines.push(line);
    pos++;
  }

  flushParagraph();
}

/** Parse a list starting at lines[pos]. Returns the new pos. */
function parseList(
  lines: string[],
  pos: number,
  parent: Node,
  ordered: boolean,
  start: number,
  marker: string,
): number {
  const list = createNode(NodeKind.List, parent);
  list.ordered = ordered;
  list.start = start;

  while (pos < lines.length) {
    const line = lines[pos];

    // Check if this line starts a new list item of the same type
    let itemMatch: RegExpExecArray | null = null;
    let itemIndent = 0;

    if (ordered) {
      itemMatch = ORDERED_LIST_RE.exec(line);
      if (itemMatch) {
        itemIndent = itemMatch[0].length;
      }
    } else {
      // Must match same marker character
      if (line.length >= 2 && line[0] === marker && line[1] === ' ') {
        itemMatch = UNORDERED_LIST_RE.exec(line);
        if (itemMatch) {
          itemIndent = 2; // marker + space
        }
      }
    }

    if (!itemMatch) {
      // Not a list item of this type — stop
      break;
    }

    // Start new list item
    const itemContent = line.slice(itemIndent);
    const itemLines: string[] = [itemContent];
    pos++;

    // Collect continuation lines (indented or blank)
    while (pos < lines.length) {
      const cl = lines[pos];
      if (isBlankLine(cl)) {
        // Blank line might be part of a loose list
        if (pos + 1 < lines.length) {
          const nextLine = lines[pos + 1];
          // If next line is indented or is a new list item, keep going
          if (nextLine.startsWith('  ') || nextLine.startsWith('\t')) {
            itemLines.push('');
            pos++;
            continue;
          }
          // Check if next line is a new item of same type
          if (ordered ? ORDERED_LIST_RE.test(nextLine) : (nextLine[0] === marker && nextLine[1] === ' ')) {
            itemLines.push('');
            pos++;
            break;
          }
        }
        break;
      }

      // Continuation: indented by at least 2 spaces (or content line)
      if (cl.startsWith('  ') || cl.startsWith('\t')) {
        // Remove up to itemIndent spaces of indentation
        let deindented = cl;
        let removed = 0;
        while (removed < itemIndent && deindented.length > 0) {
          if (deindented[0] === ' ') {
            deindented = deindented.slice(1);
            removed++;
          } else if (deindented[0] === '\t') {
            deindented = deindented.slice(1);
            removed += 4;
          } else {
            break;
          }
        }
        itemLines.push(deindented);
        pos++;
        continue;
      }

      // Non-indented, non-blank line — check if it's a new list item
      if (ordered ? ORDERED_LIST_RE.test(cl) : (cl[0] === marker && cl.length >= 2 && cl[1] === ' ')) {
        break; // Will be picked up by outer loop
      }

      // Lazy continuation for paragraphs
      if (!isBlankLine(itemLines[itemLines.length - 1])) {
        itemLines.push(cl);
        pos++;
        continue;
      }

      break;
    }

    const listItem = createNode(NodeKind.ListItem, list);

    // Check for task checkbox
    const firstLine = itemLines[0] || '';
    const taskMatch = /^\[([ xX])\]\s?/.exec(firstLine);
    if (taskMatch) {
      const checkbox = createNode(NodeKind.TaskCheckbox, listItem);
      checkbox.checked = taskMatch[1] === 'x' || taskMatch[1] === 'X';
      itemLines[0] = firstLine.slice(taskMatch[0].length);
    }

    parseBlocks(itemLines, listItem);
  }

  return pos;
}

/** Parse a GFM table starting at lines[pos]. Returns the new pos. */
function parseTable(
  lines: string[],
  pos: number,
  parent: Node,
  alignments: ('left' | 'center' | 'right' | 'none')[],
): number {
  const table = createNode(NodeKind.Table, parent);
  table.alignments = alignments;

  // Header row
  const headerLine = lines[pos];
  const headerCells = splitTableRow(headerLine);
  const thead = createNode(NodeKind.TableHeader, table);
  const headerRow = createNode(NodeKind.TableRow, thead);
  for (const cellText of headerCells) {
    const cell = createNode(NodeKind.TableCell, headerRow);
    parseInlines(cellText, cell);
  }
  pos += 2; // skip header + delimiter

  // Data rows
  while (pos < lines.length) {
    const line = lines[pos];
    if (isBlankLine(line) || !line.includes('|')) break;

    // Verify it's not a new block element
    if (ATX_HEADING_RE.test(line) || THEMATIC_BREAK_RE.test(line)) break;

    const cells = splitTableRow(line);
    const row = createNode(NodeKind.TableRow, table);
    for (const cellText of cells) {
      const cell = createNode(NodeKind.TableCell, row);
      parseInlines(cellText, cell);
    }
    pos++;
  }

  return pos;
}

// ─── Inline Parsing ─────────────────────────────────────────────────────────

/** Parse inline content and add children to parent node. */
function parseInlines(text: string, parent: Node): void {
  if (text.length === 0) return;

  let pos = 0;
  let textBuf = '';

  function flushText(): void {
    if (textBuf.length > 0) {
      createTextNode(textBuf, parent);
      textBuf = '';
    }
  }

  while (pos < text.length) {
    const ch = text[pos];

    // Backslash escape
    if (ch === '\\' && pos + 1 < text.length) {
      const next = text[pos + 1];
      if (next === '\n') {
        // Hard line break
        flushText();
        const br = createNode(NodeKind.HardBreak, parent);
        br.hardBreak = true;
        pos += 2;
        continue;
      }
      if (/[\\`*_{}[\]()#+\-.!|~<>&"']/.test(next)) {
        textBuf += next;
        pos += 2;
        continue;
      }
    }

    // Newline
    if (ch === '\n') {
      // Check for hard break (2+ trailing spaces before newline)
      if (textBuf.endsWith('  ')) {
        textBuf = textBuf.replace(/\s+$/, '');
        flushText();
        const br = createNode(NodeKind.HardBreak, parent);
        br.hardBreak = true;
      } else {
        flushText();
        const sb = createNode(NodeKind.SoftBreak, parent);
        sb.softBreak = true;
      }
      pos++;
      continue;
    }

    // Code span
    if (ch === '`') {
      const result = parseCodeSpan(text, pos);
      if (result) {
        flushText();
        const cs = createNode(NodeKind.CodeSpan, parent);
        cs.literal = result.content;
        pos = result.end;
        continue;
      }
    }

    // Autolink: <url> or <email>
    if (ch === '<') {
      const result = parseAutolink(text, pos);
      if (result) {
        flushText();
        const al = createNode(NodeKind.AutoLink, parent);
        al.literal = result.content;
        al.destination = result.destination;
        pos = result.end;
        continue;
      }
      // HTML inline
      const htmlResult = parseHtmlInline(text, pos);
      if (htmlResult) {
        flushText();
        const hi = createNode(NodeKind.HtmlInline, parent);
        hi.literal = htmlResult.content;
        pos = htmlResult.end;
        continue;
      }
    }

    // Image: ![alt](url "title")
    if (ch === '!' && pos + 1 < text.length && text[pos + 1] === '[') {
      const result = parseLinkOrImage(text, pos + 1, true);
      if (result) {
        flushText();
        const img = createNode(NodeKind.Image, parent);
        img.destination = result.destination;
        img.title = result.title || undefined;
        // Parse alt text as inline children
        parseInlines(result.text, img);
        pos = result.end;
        continue;
      }
    }

    // Link: [text](url "title")
    if (ch === '[') {
      const result = parseLinkOrImage(text, pos, false);
      if (result) {
        flushText();
        const link = createNode(NodeKind.Link, parent);
        link.destination = result.destination;
        link.title = result.title || undefined;
        parseInlines(result.text, link);
        pos = result.end;
        continue;
      }
    }

    // Strikethrough: ~~text~~
    if (ch === '~' && pos + 1 < text.length && text[pos + 1] === '~') {
      const result = parseDelimiterRun(text, pos, '~~', '~~');
      if (result) {
        flushText();
        const st = createNode(NodeKind.Strikethrough, parent);
        parseInlines(result.content, st);
        pos = result.end;
        continue;
      }
    }

    // Emphasis: ** or __ (strong, level 2) — check before single * or _
    if ((ch === '*' || ch === '_') && pos + 1 < text.length && text[pos + 1] === ch) {
      const delim = ch + ch;
      const result = parseEmphasis(text, pos, delim);
      if (result) {
        flushText();
        const em = createNode(NodeKind.Emphasis, parent);
        em.level = 2;
        parseInlines(result.content, em);
        pos = result.end;
        continue;
      }
    }

    // Emphasis: * or _ (emphasis, level 1)
    if (ch === '*' || ch === '_') {
      const result = parseEmphasis(text, pos, ch);
      if (result) {
        flushText();
        const em = createNode(NodeKind.Emphasis, parent);
        em.level = 1;
        parseInlines(result.content, em);
        pos = result.end;
        continue;
      }
    }

    // HTML entity
    if (ch === '&') {
      const result = parseEntity(text, pos);
      if (result) {
        textBuf += result.decoded;
        pos = result.end;
        continue;
      }
    }

    // Regular character
    textBuf += ch;
    pos++;
  }

  flushText();
}

// ─── Inline Parsing Helpers ─────────────────────────────────────────────────

interface CodeSpanResult {
  content: string;
  end: number;
}

function parseCodeSpan(text: string, pos: number): CodeSpanResult | null {
  // Count opening backticks
  let ticks = 0;
  let i = pos;
  while (i < text.length && text[i] === '`') {
    ticks++;
    i++;
  }
  if (ticks === 0) return null;

  // Find matching closing backtick sequence
  const closePattern = '`'.repeat(ticks);
  let searchPos = i;
  while (searchPos < text.length) {
    const closeIdx = text.indexOf(closePattern, searchPos);
    if (closeIdx === -1) return null;

    // Make sure the closing backticks are exactly the right length
    const afterClose = closeIdx + ticks;
    if (afterClose < text.length && text[afterClose] === '`') {
      // Too many backticks — skip
      searchPos = afterClose;
      while (searchPos < text.length && text[searchPos] === '`') searchPos++;
      continue;
    }

    let content = text.slice(i, closeIdx);
    // Strip one leading and one trailing space if both present and content is not all spaces
    if (content.length >= 2 && content[0] === ' ' && content[content.length - 1] === ' ' &&
        content.trim().length > 0) {
      content = content.slice(1, -1);
    }
    // Collapse internal newlines to spaces
    content = content.replace(/\n/g, ' ');

    return { content, end: afterClose };
  }

  return null;
}

interface AutolinkResult {
  content: string;
  destination: string;
  end: number;
}

function parseAutolink(text: string, pos: number): AutolinkResult | null {
  if (text[pos] !== '<') return null;
  const closeIdx = text.indexOf('>', pos + 1);
  if (closeIdx === -1) return null;
  const content = text.slice(pos + 1, closeIdx);

  // URL autolink
  if (/^[a-zA-Z][a-zA-Z0-9+.-]{1,31}:\/?\/?[^\s<>]*$/.test(content)) {
    return { content, destination: content, end: closeIdx + 1 };
  }
  // Email autolink
  if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(content)) {
    return { content, destination: `mailto:${content}`, end: closeIdx + 1 };
  }
  return null;
}

interface HtmlInlineResult {
  content: string;
  end: number;
}

function parseHtmlInline(text: string, pos: number): HtmlInlineResult | null {
  if (text[pos] !== '<') return null;

  // Opening tag: <tag ...>
  // Closing tag: </tag>
  // Comment: <!-- ... -->
  // Processing: <? ... ?>
  // Declaration: <! ... >
  // CDATA: <![CDATA[ ... ]]>

  // Simple approach: find matching >
  const tagMatch = /^<(?:\/?\w[\w-]*(?:\s[^>]*)?\/?|!--[\s\S]*?--|!\w[^>]*|\?[\s\S]*?\?)>/.exec(
    text.slice(pos),
  );
  if (tagMatch) {
    return { content: tagMatch[0], end: pos + tagMatch[0].length };
  }
  return null;
}

interface LinkResult {
  text: string;
  destination: string;
  title: string;
  end: number;
}

function parseLinkOrImage(text: string, pos: number, isImage: boolean): LinkResult | null {
  if (text[pos] !== '[') return null;

  // Find matching ]
  let depth = 0;
  let i = pos;
  while (i < text.length) {
    if (text[i] === '\\' && i + 1 < text.length) {
      i += 2;
      continue;
    }
    if (text[i] === '[') depth++;
    if (text[i] === ']') {
      depth--;
      if (depth === 0) break;
    }
    i++;
  }
  if (i >= text.length || depth !== 0) return null;

  const linkText = text.slice(pos + 1, i);
  i++; // skip ]

  // Must be immediately followed by (
  if (i >= text.length || text[i] !== '(') return null;
  i++; // skip (

  // Skip optional whitespace
  while (i < text.length && (text[i] === ' ' || text[i] === '\n')) i++;

  // Parse destination
  let destination = '';
  if (i < text.length && text[i] === '<') {
    // Angle-bracket destination
    i++;
    const closeAngle = text.indexOf('>', i);
    if (closeAngle === -1) return null;
    destination = text.slice(i, closeAngle);
    i = closeAngle + 1;
  } else {
    // Bare destination (handle balanced parens)
    let parenDepth = 0;
    const start = i;
    while (i < text.length) {
      const c = text[i];
      if (c === '\\' && i + 1 < text.length) {
        i += 2;
        continue;
      }
      if (c === '(') {
        parenDepth++;
      } else if (c === ')') {
        if (parenDepth === 0) break;
        parenDepth--;
      } else if (c === ' ' || c === '\n') {
        break;
      }
      i++;
    }
    destination = text.slice(start, i);
  }

  // Skip optional whitespace
  while (i < text.length && (text[i] === ' ' || text[i] === '\n')) i++;

  // Parse optional title
  let title = '';
  if (i < text.length && (text[i] === '"' || text[i] === "'" || text[i] === '(')) {
    const openQuote = text[i];
    const closeQuote = openQuote === '(' ? ')' : openQuote;
    i++;
    const titleStart = i;
    while (i < text.length && text[i] !== closeQuote) {
      if (text[i] === '\\' && i + 1 < text.length) i++;
      i++;
    }
    if (i >= text.length) return null;
    title = text.slice(titleStart, i);
    i++; // skip closing quote
  }

  // Skip optional whitespace and closing )
  while (i < text.length && (text[i] === ' ' || text[i] === '\n')) i++;
  if (i >= text.length || text[i] !== ')') return null;
  i++; // skip )

  const startOffset = isImage ? pos - 1 : pos; // account for ! in image
  return {
    text: linkText,
    destination,
    title,
    end: i,
  };
}

interface DelimiterResult {
  content: string;
  end: number;
}

function parseDelimiterRun(
  text: string,
  pos: number,
  open: string,
  close: string,
): DelimiterResult | null {
  if (!text.startsWith(open, pos)) return null;
  const start = pos + open.length;

  // Find closing delimiter (not preceded by the delimiter char)
  let searchPos = start;
  while (searchPos < text.length) {
    const idx = text.indexOf(close, searchPos);
    if (idx === -1) return null;
    if (idx === start) {
      // Empty content — not valid
      return null;
    }
    return { content: text.slice(start, idx), end: idx + close.length };
  }
  return null;
}

function parseEmphasis(text: string, pos: number, delim: string): DelimiterResult | null {
  if (!text.startsWith(delim, pos)) return null;
  const start = pos + delim.length;

  // Content must not start with a space
  if (start >= text.length || text[start] === ' ') return null;

  // Find closing delimiter
  let searchPos = start;
  let depth = 0;
  while (searchPos < text.length) {
    // Handle escape
    if (text[searchPos] === '\\' && searchPos + 1 < text.length) {
      searchPos += 2;
      continue;
    }

    // Handle code spans (skip over them)
    if (text[searchPos] === '`') {
      const cs = parseCodeSpan(text, searchPos);
      if (cs) {
        searchPos = cs.end;
        continue;
      }
    }

    // Check for closing delimiter
    if (text.startsWith(delim, searchPos)) {
      // Must not be preceded by space
      if (searchPos > start && text[searchPos - 1] !== ' ') {
        const content = text.slice(start, searchPos);
        return { content, end: searchPos + delim.length };
      }
    }

    searchPos++;
  }

  return null;
}

interface EntityResult {
  decoded: string;
  end: number;
}

function parseEntity(text: string, pos: number): EntityResult | null {
  if (text[pos] !== '&') return null;

  // Named entity: &amp;
  const namedMatch = /^&([a-zA-Z][a-zA-Z0-9]{1,31});/.exec(text.slice(pos));
  if (namedMatch) {
    const decoded = decodeNamedEntity(namedMatch[1]);
    if (decoded) {
      return { decoded, end: pos + namedMatch[0].length };
    }
  }

  // Numeric entity: &#123;
  const decMatch = /^&#(\d{1,7});/.exec(text.slice(pos));
  if (decMatch) {
    const code = parseInt(decMatch[1], 10);
    if (code > 0 && code <= 0x10FFFF) {
      return { decoded: String.fromCodePoint(code), end: pos + decMatch[0].length };
    }
  }

  // Hex entity: &#xAB;
  const hexMatch = /^&#[xX]([0-9a-fA-F]{1,6});/.exec(text.slice(pos));
  if (hexMatch) {
    const code = parseInt(hexMatch[1], 16);
    if (code > 0 && code <= 0x10FFFF) {
      return { decoded: String.fromCodePoint(code), end: pos + hexMatch[0].length };
    }
  }

  return null;
}

/** Decode a subset of common HTML named entities. */
function decodeNamedEntity(name: string): string | null {
  const entities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: '\u00A0',
    ndash: '\u2013',
    mdash: '\u2014',
    lsquo: '\u2018',
    rsquo: '\u2019',
    ldquo: '\u201C',
    rdquo: '\u201D',
    bull: '\u2022',
    hellip: '\u2026',
    copy: '\u00A9',
    reg: '\u00AE',
    trade: '\u2122',
    laquo: '\u00AB',
    raquo: '\u00BB',
    larr: '\u2190',
    rarr: '\u2192',
    uarr: '\u2191',
    darr: '\u2193',
    hearts: '\u2665',
    diams: '\u2666',
    clubs: '\u2663',
    spades: '\u2660',
    para: '\u00B6',
    sect: '\u00A7',
    deg: '\u00B0',
    plusmn: '\u00B1',
    micro: '\u00B5',
    middot: '\u00B7',
    frac14: '\u00BC',
    frac12: '\u00BD',
    frac34: '\u00BE',
    times: '\u00D7',
    divide: '\u00F7',
    infin: '\u221E',
    euro: '\u20AC',
    pound: '\u00A3',
    yen: '\u00A5',
    cent: '\u00A2',
  };
  return entities[name] ?? null;
}

// ─── Main parse() function ──────────────────────────────────────────────────

/**
 * Parse a markdown string into an AST.
 * @param markdown - The markdown source text
 * @returns The root Document node
 */
export function parse(markdown: string): Node {
  const root: Node = {
    kind: NodeKind.Document,
    children: [],
    parent: null,
    prevSibling: null,
    nextSibling: null,
  };

  // Normalize line endings
  const normalized = markdown.replace(/\r\n?/g, '\n');

  // Split into lines (keep the structure, don't strip trailing newline)
  let lines = normalized.split('\n');

  // Remove a single trailing empty string from split (artifact of trailing \n)
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  parseBlocks(lines, root);

  return root;
}
