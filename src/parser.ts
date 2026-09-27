import { get as getEmoji, has as hasEmoji } from 'node-emoji';

// parser.ts — GFM Markdown parser for @oakoliver/glamour
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
  DefinitionList: 'definition_list',
  DefinitionTerm: 'definition_term',
  DefinitionDescription: 'definition_description',
  Emoji: 'emoji',
} as const;

export type NodeKindType = (typeof NodeKind)[keyof typeof NodeKind];
export interface ParseOptions {
  /** Expand GitHub emoji shortcodes, matching glamour.WithEmoji. */
  emoji?: boolean;
}

interface LinkReference {
  destination: string;
  title: string;
}

interface ParseContext {
  emoji: boolean;
  references: Map<string, LinkReference>;
}

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

  /** @internal Source span of a Text node while inlines are parsed. */
  segStart?: number;
  /** @internal */
  segStop?: number;
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

// ─── Block Parsing Helpers ──────────────────────────────────────────────────

const ATX_HEADING_RE = /^(#{1,6})[ \t]+(.*?)(?:[ \t]+#+[ \t]*)?$/;
const THEMATIC_BREAK_RE = /^(?: {0,3})(?:(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|(?:-[ \t]*){3,})$/;
const FENCED_CODE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*(.*)?$/;
const UNORDERED_LIST_RE = /^ {0,3}([-+*])([ \t]+)/;
const ORDERED_LIST_RE = /^ {0,3}(\d{1,9})([.)])([ \t]+)/;
const BLOCKQUOTE_RE = /^ {0,3}>[ \t]?/;
const TABLE_DELIM_RE = /^\|?[\s:-]+\|[\s|:-]*$/;
const TABLE_DELIM_CELL_RE = /^:?-+:?$/;
const HTML_BLOCK_RE = /^<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|pre|script|section|source|style|summary|table|tbody|td|textarea|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i;
const HTML_COMMENT_RE = /^<!--/;
/** CommonMark HTML block type 7: a lone complete open or closing tag (cannot interrupt a paragraph). */
const HTML_TYPE7_RE = /^ {0,3}(?:<[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][\w.:-]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*\/?>|<\/[A-Za-z][A-Za-z0-9-]*\s*>)\s*$/;
const HTML_PI_RE = /^<\?/;
const HTML_DECL_RE = /^<![A-Z]/;
const HTML_CDATA_RE = /^<!\[CDATA\[/;
const SETEXT_H1_RE = /^=+\s*$/;
const SETEXT_H2_RE = /^-+\s*$/;
const DEFINITION_MARKER_RE = /^ {0,3}:[ \t]+(.*)$/;

interface HtmlBlockStart {
  end: RegExp | null;
  untilBlank: boolean;
}

function classifyHtmlBlockStart(line: string): HtmlBlockStart | null {
  const explicit = (
    pattern: RegExp,
    terminator: RegExp,
  ): HtmlBlockStart | null => {
    if (!pattern.test(line)) return null;
    return {
      end: terminator.test(line) ? null : terminator,
      untilBlank: false,
    };
  };

  const comment = explicit(HTML_COMMENT_RE, /-->/);
  if (comment) return comment;
  const cdata = explicit(HTML_CDATA_RE, /\]\]>/);
  if (cdata) return cdata;
  const processing = explicit(HTML_PI_RE, /\?>/);
  if (processing) return processing;
  const declaration = explicit(HTML_DECL_RE, />/);
  if (declaration) return declaration;

  const rawTag = /^ {0,3}<(pre|script|style|textarea)\b/i.exec(line)?.[1];
  if (rawTag) {
    const terminator = new RegExp(`</${rawTag}\\s*>`, 'i');
    return {
      end: terminator.test(line) ? null : terminator,
      untilBlank: false,
    };
  }
  if (HTML_BLOCK_RE.test(line)) return { end: null, untilBlank: true };
  return null;
}

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
/** Width of a line's leading whitespace, with tabs advancing to the next multiple of 4. */
function indentWidth(line: string): number {
  let width = 0;
  for (const c of line) {
    if (c === ' ') width++;
    else if (c === '\t') width += 4 - (width % 4);
    else break;
  }
  return width;
}

/** Paragraph lines lose leading whitespace; the last line loses trailing whitespace. */
function paragraphText(lines: string[]): string {
  return lines.map((line) => line.replace(/^[ \t]+/, '')).join('\n').replace(/[ \t]+$/, '');
}

/** Whether a line opens a block that interrupts a lazy continuation. */
function startsBlock(line: string): boolean {
  return UNORDERED_LIST_RE.test(line) || ORDERED_LIST_RE.test(line) ||
    ATX_HEADING_RE.test(line) || THEMATIC_BREAK_RE.test(line) ||
    FENCED_CODE_OPEN_RE.test(line) || BLOCKQUOTE_RE.test(line);
}

function parseBlocks(lines: string[], parent: Node, context: ParseContext): void {
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
    parseInlines(paragraphText(paraLines), para, context);
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
    // Definition list: a paragraph immediately followed by ": description".
    if (paraLines.length > 0 && DEFINITION_MARKER_RE.test(line)) {
      const terms = paraLines;
      paraLines = [];
      pos = parseDefinitionList(lines, pos, parent, terms, context);
      continue;
    }

    // ATX Heading
    const atxMatch = ATX_HEADING_RE.exec(line);
    if (atxMatch) {
      flushParagraph();
      const level = atxMatch[1].length;
      const content = (atxMatch[2] ?? '').trim();
      const heading = createNode(NodeKind.Heading, parent);
      heading.level = level;
      parseInlines(content, heading, context);
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
        const text = paragraphText(paraLines);
        paraLines = [];
        const heading = createNode(NodeKind.Heading, parent);
        heading.level = 1;
        parseInlines(text, heading, context);
        pos++;
        continue;
      }
      if (SETEXT_H2_RE.test(line)) {
        const text = paragraphText(paraLines);
        paraLines = [];
        const heading = createNode(NodeKind.Heading, parent);
        heading.level = 2;
        parseInlines(text, heading, context);
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
      const openingIndent = line.length - line.trimStart().length;
      pos++;

      const codeLines: string[] = [];
      while (pos < lines.length) {
        const cl = lines[pos];
        const closeRe = new RegExp(`^ {0,3}${fenceChar}{${fenceLen},}[ \\t]*$`);
        if (closeRe.test(cl)) {
          pos++;
          break;
        }
        codeLines.push(cl.replace(new RegExp(`^ {0,${openingIndent}}`), ''));
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
      for (const [label, reference] of extractLinkReferences(quoteLines)) {
        if (!context.references.has(label)) context.references.set(label, reference);
      }
      parseBlocks(quoteLines, bq, context);
      continue;
    }

    // Unordered list
    const ulMatch = UNORDERED_LIST_RE.exec(line);
    if (ulMatch) {
      flushParagraph();
      const marker = ulMatch[1];
      pos = parseList(lines, pos, parent, false, 0, marker, context);
      continue;
    }

    // Ordered list
    const olMatch = ORDERED_LIST_RE.exec(line);
    if (olMatch) {
      flushParagraph();
      const startNum = parseInt(olMatch[1], 10);
      pos = parseList(lines, pos, parent, true, startNum, '', context);
      continue;
    }

    // HTML block
    const htmlStart = classifyHtmlBlockStart(line) ??
      (paraLines.length === 0 && HTML_TYPE7_RE.test(line) ? { end: null, untilBlank: true } : null);
    if (htmlStart) {
      flushParagraph();
      const htmlLines: string[] = [line];
      pos++;
      if (htmlStart.end) {
        while (pos < lines.length) {
          const htmlLine = lines[pos++];
          htmlLines.push(htmlLine);
          if (htmlStart.end.test(htmlLine)) break;
        }
      } else if (htmlStart.untilBlank) {
        while (pos < lines.length && !isBlankLine(lines[pos])) {
          htmlLines.push(lines[pos]);
          pos++;
        }
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
        pos = parseTable(lines, pos, parent, alignments, context);
        continue;
      }
    }

    // Default: paragraph continuation
    paraLines.push(line);
    pos++;
  }


  flushParagraph();
}
function parseDefinitionList(
  lines: string[],
  start: number,
  parent: Node,
  initialTermLines: string[],
  context: ParseContext,
): number {
  const list = createNode(NodeKind.DefinitionList, parent);
  let pos = start;
  let termLines = initialTermLines;
  let blankBefore = false;
  while (termLines.length > 0) {

    for (const termLine of termLines) {
      const term = createNode(NodeKind.DefinitionTerm, list);
      parseInlines(termLine, term, context);
    }

    while (pos < lines.length) {
      const marker = DEFINITION_MARKER_RE.exec(lines[pos]);
      if (!marker) break;

      const descriptionLines = [marker[1]];
      pos++;
      while (pos < lines.length) {
        const continuation = lines[pos];
        if (DEFINITION_MARKER_RE.test(continuation)) break;
        if (isBlankLine(continuation)) {
          if (pos + 1 < lines.length && /^(?: {2,}|\t)/.test(lines[pos + 1])) {
            descriptionLines.push('');
            pos++;
            continue;
          }
          break;
        }
        if (/^(?: {2,}|\t)/.test(continuation)) {
          descriptionLines.push(continuation.replace(/^(?: {1,4}|\t)/, ''));
          pos++;
          continue;
        }
        break;
      }

      const description = createNode(NodeKind.DefinitionDescription, list);
      parseBlocks(descriptionLines, description, context);
      // Tight descriptions hold TextBlocks, not paragraphs (goldmark).
      if (!blankBefore) {
        for (const child of description.children) {
          if (child.kind === NodeKind.Paragraph) child.kind = NodeKind.TextBlock;
        }
      }
      blankBefore = false;
      while (pos < lines.length && isBlankLine(lines[pos])) {
        pos++;
        blankBefore = true;
      }
    }

    if (
      pos + 1 < lines.length &&
      !isBlankLine(lines[pos]) &&
      DEFINITION_MARKER_RE.test(lines[pos + 1])
    ) {
      termLines = [lines[pos]];
      blankBefore = false;
      pos++;
    } else {
      termLines = [];
    }
  }

  return pos;
}

/** Parse a list starting at lines[pos]. Returns the new pos. */
function parseList(
  lines: string[],
  pos: number,
  parent: Node,
  ordered: boolean,
  start: number,
  marker: string,
  context: ParseContext,
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
      itemMatch = UNORDERED_LIST_RE.exec(line);
      if (itemMatch?.[1] !== marker) {
        itemMatch = null;
      } else {
        itemIndent = itemMatch[0].length;
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
          if (indentWidth(nextLine) >= itemIndent) {
            itemLines.push('');
            pos++;
            continue;
          }
          // Check if next line is a new item of same type
          const nextUnordered = UNORDERED_LIST_RE.exec(nextLine);
          if (ordered ? ORDERED_LIST_RE.test(nextLine) : nextUnordered?.[1] === marker) {
            itemLines.push('');
            pos++;
            break;
          }
        }
        break;
      }

      // Continuation: indented to at least the item's content column
      if (indentWidth(cl) >= itemIndent) {
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
      const nextUnordered = UNORDERED_LIST_RE.exec(cl);
      if (ordered ? ORDERED_LIST_RE.test(cl) : nextUnordered?.[1] === marker) {
        break; // Will be picked up by outer loop
      }

      // Lazy continuation for paragraphs
      if (!isBlankLine(itemLines[itemLines.length - 1]) && !startsBlock(cl)) {
        itemLines.push(cl);
        pos++;
        continue;
      }

      break;
    }

    for (const [label, reference] of extractLinkReferences(itemLines)) {
      if (!context.references.has(label)) context.references.set(label, reference);
    }
    if (itemLines.every(isBlankLine)) continue;

    const listItem = createNode(NodeKind.ListItem, list);
    const firstLine = itemLines[0] || '';
    const taskMatch = /^\[([ xX])\]\s?/.exec(firstLine);
    if (taskMatch) itemLines[0] = firstLine.slice(taskMatch[0].length);
    parseBlocks(itemLines, listItem, context);
    if (taskMatch) {
      // goldmark puts the checkbox first inside the item's first text block.
      const first = listItem.children[0];
      const holder = first && first.kind === NodeKind.Paragraph ? first : listItem;
      const checkbox: Node = {
        kind: NodeKind.TaskCheckbox, children: [], parent: holder, prevSibling: null, nextSibling: null,
      };
      checkbox.checked = taskMatch[1] === 'x' || taskMatch[1] === 'X';
      holder.children.unshift(checkbox);
      checkbox.nextSibling = holder.children[1] ?? null;
      if (checkbox.nextSibling) checkbox.nextSibling.prevSibling = checkbox;
    }
  }

  return pos;
}

/** Parse a GFM table starting at lines[pos]. Returns the new pos. */
function parseTable(
  lines: string[],
  pos: number,
  parent: Node,
  alignments: ('left' | 'center' | 'right' | 'none')[],
  context: ParseContext,
): number {
  const table = createNode(NodeKind.Table, parent);
  table.alignments = alignments;

  // Header row
  const headerLine = lines[pos];
  const headerCells = splitTableRow(headerLine);
  const thead = createNode(NodeKind.TableHeader, table);
  for (const cellText of headerCells) {
    const cell = createNode(NodeKind.TableCell, thead);
    parseInlines(cellText.trim(), cell, context);
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
      parseInlines(cellText.trim(), cell, context);
    }
    pos++;
  }

  return pos;
}

// ─── Inline Parsing ─────────────────────────────────────────────────────────

/** Parse inline content and add children to parent node. */
/**
 * Inline nodes carry the source span of their text so adjacent segments can
 * be merged exactly the way goldmark merges them. Rendering depends on this:
 * every Text node becomes its own styled run.
 */
interface InlineState {
  text: string;
  context: ParseContext;
  /** Delimiter runs (emphasis/strikethrough) and unmatched link openers. */
  delimiters: Delimiter[];
  /** Unmatched '[' / '![' openers not yet closed by a ']'. */
  openLabels: number;
}

interface Delimiter {
  node: Node;
  char: string;
  length: number;
  originalLength: number;
  canOpen: boolean;
  canClose: boolean;
  /** Link label openers never pair; they turn back into text. */
  label: boolean;
}

const DELIMITER_KIND = '\0delimiter';

/** util.IsPunct: ASCII punctuation. */
function isASCIIPunct(c: string): boolean {
  return /^[!-/:-@[-`{-~]$/.test(c);
}

/** util.IsSpace for inline scanning (' ', \t, \v, \f; line ends excluded). */
function isInlineSpace(c: string): boolean {
  return c === ' ' || c === '\t' || c === '\v' || c === '\f';
}

/** util.IsPunctRune: Unicode punctuation or symbol. */
function isPunctRune(c: string): boolean {
  return /^[\p{P}\p{S}]$/u.test(c);
}

/** util.IsSpaceRune */
function isSpaceRune(c: string): boolean {
  return /^\s$/u.test(c);
}

function segmentText(node: Node, state: InlineState): string {
  return state.text.slice(node.segStart ?? 0, node.segStop ?? 0);
}

function newTextSegment(parent: Node, start: number, stop: number): Node {
  const node = createNode(NodeKind.Text, parent);
  node.segStart = start;
  node.segStop = stop;
  return node;
}

/** ast.MergeOrAppendTextSegment */
function mergeOrAppendTextSegment(parent: Node, start: number, stop: number): void {
  const last = parent.children[parent.children.length - 1];
  if (last && last.kind === NodeKind.Text && last.segStop === start && !last.softBreak) {
    last.segStop = stop;
  } else {
    newTextSegment(parent, start, stop);
  }
}

function replaceChild(parent: Node, old: Node, replacement: Node[]): void {
  const index = parent.children.indexOf(old);
  if (index < 0) return;
  parent.children.splice(index, 1, ...replacement);
  for (const child of replacement) child.parent = parent;
}

/** ast.MergeOrReplaceTextSegment */
function mergeOrReplaceTextSegment(parent: Node, node: Node, start: number, stop: number): void {
  const index = parent.children.indexOf(node);
  const prev = index > 0 ? parent.children[index - 1] : undefined;
  if (prev && prev.kind === NodeKind.Text && prev.segStop === start && !prev.softBreak) {
    prev.segStop = stop;
    parent.children.splice(index, 1);
  } else {
    const text: Node = {
      kind: NodeKind.Text, children: [], parent, prevSibling: null, nextSibling: null,
      segStart: start, segStop: stop,
    };
    replaceChild(parent, node, [text]);
  }
}

/** parser.ScanDelimiter */
function scanDelimiter(text: string, pos: number, before: string): Delimiter | null {
  const c = text[pos];
  let j = pos;
  while (j < text.length && text[j] === c) j++;
  const length = j - pos;
  if (length < 1) return null;
  const after = j < text.length ? String.fromCodePoint(text.codePointAt(j) ?? 32) : ' ';

  const beforeIsPunctuation = isPunctRune(before);
  const beforeIsWhitespace = isSpaceRune(before);
  const afterIsPunctuation = isPunctRune(after);
  const afterIsWhitespace = isSpaceRune(after);

  const isLeft = !afterIsWhitespace && (!afterIsPunctuation || beforeIsWhitespace || beforeIsPunctuation);
  const isRight = !beforeIsWhitespace && (!beforeIsPunctuation || afterIsWhitespace || afterIsPunctuation);

  let canOpen: boolean;
  let canClose: boolean;
  if (c === '_') {
    canOpen = isLeft && (!isRight || beforeIsPunctuation);
    canClose = isRight && (!isLeft || afterIsPunctuation);
  } else {
    canOpen = isLeft;
    canClose = isRight;
  }
  const node: Node = { kind: DELIMITER_KIND, children: [], parent: null, prevSibling: null, nextSibling: null };
  return { node, char: c, length, originalLength: length, canOpen, canClose, label: false };
}

/** Delimiter.CalcComsumption */
function calcConsumption(opener: Delimiter, closer: Delimiter): number {
  if ((opener.canClose || closer.canOpen) &&
    (opener.originalLength + closer.originalLength) % 3 === 0 &&
    closer.originalLength % 3 !== 0) {
    return 0;
  }
  if (opener.length >= 2 && closer.length >= 2) return 2;
  return 1;
}

/** Turn a remaining delimiter back into text (parseContext.RemoveDelimiter). */
function removeDelimiter(state: InlineState, d: Delimiter): void {
  const index = state.delimiters.indexOf(d);
  if (index >= 0) state.delimiters.splice(index, 1);
  const parent = d.node.parent;
  if (!parent) return;
  if (d.length !== 0) {
    const start = d.node.segStart ?? 0;
    mergeOrReplaceTextSegment(parent, d.node, start, start + d.length);
  } else {
    replaceChild(parent, d.node, []);
  }
}

/** parser.ProcessDelimiters with a nil bottom. */
function processDelimiters(state: InlineState): void {
  const list = state.delimiters;
  let ci = 0;
  while (ci < list.length) {
    const closer = list[ci];
    if (closer.label || !closer.canClose) {
      ci++;
      continue;
    }
    let consume = 0;
    let found = false;
    let maybeOpener = false;
    let oi = ci - 1;
    for (; oi >= 0; oi--) {
      const opener = list[oi];
      if (!opener.label && opener.canOpen && opener.char === closer.char) {
        maybeOpener = true;
        consume = calcConsumption(opener, closer);
        if (consume > 0) {
          found = true;
          break;
        }
      }
    }
    if (!found) {
      if (!maybeOpener && !closer.canOpen) {
        removeDelimiter(state, closer);
      } else {
        ci++;
      }
      continue;
    }

    const opener = list[oi];
    opener.length -= consume;
    closer.length -= consume;

    const parent = opener.node.parent as Node;
    const kind = opener.char === '~' ? NodeKind.Strikethrough : NodeKind.Emphasis;
    const node: Node = { kind, children: [], parent, prevSibling: null, nextSibling: null };
    if (kind === NodeKind.Emphasis) node.level = consume;

    const from = parent.children.indexOf(opener.node) + 1;
    const to = parent.children.indexOf(closer.node);
    const moved = parent.children.splice(from, to - from, node);
    for (const child of moved) child.parent = node;
    node.children = moved;

    // remove delimiters between opener and closer
    for (let k = ci - 1; k > oi; k--) removeDelimiter(state, list[k]);
    ci = list.indexOf(closer);

    if (opener.length === 0) {
      removeDelimiter(state, opener);
      ci = list.indexOf(closer);
    }
    if (closer.length === 0) {
      removeDelimiter(state, closer);
    }
  }
  while (list.length > 0) removeDelimiter(state, list[list.length - 1]);
}

const LINKIFY_WWW_RE = /^www\.[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-z]+(?:[/#?][-a-zA-Z0-9@:%_+.~#!?&/=();,'">^{}[\]`]*)?/;
const LINKIFY_URL_RE = /^(?:http|https|ftp):\/\/[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-z]+(?::\d+)?(?:[/#?][-a-zA-Z0-9@:%_+.~#$!?&/=();,'">^{}[\]`]*)?/;
const EMAIL_LOCAL_CHARS = /[!#$%&'*+\-./0-9=?A-Z^_`a-z{|}~]/;
const EMAIL_DOMAIN_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/;

/** util.FindEmailIndex */
function findEmailIndex(b: string): number {
  let i = 0;
  while (i < b.length && EMAIL_LOCAL_CHARS.test(b[i])) i++;
  if (i === 0 || i >= b.length || b[i] !== '@') return -1;
  i++;
  if (i >= b.length) return -1;
  const match = EMAIL_DOMAIN_RE.exec(b.slice(i));
  if (!match) return -1;
  return i + match[0].length;
}

/**
 * The linkify extension's parser (goldmark extension/linkify.go), run on the
 * text starting at `pos` (after any consumed trigger character).
 */
function linkifyAt(text: string, pos: number, lineEnd: number): AutolinkResult | null {
  const line = text.slice(pos, lineEnd);
  if (line.length === 0) return null;
  let m: [number, number] | null = null;
  let protocol = '';
  let email = false;
  if (/^(?:http:|https:|ftp:)/.test(line)) {
    const match = LINKIFY_URL_RE.exec(line);
    if (match) m = [0, match[0].length];
  }
  if (!m && line.startsWith('www.')) {
    const match = LINKIFY_WWW_RE.exec(line);
    if (match) m = [0, match[0].length];
    protocol = 'http';
  }
  if (m) {
    const lastChar = line[m[1] - 1];
    if (lastChar === '.') {
      m[1]--;
    } else if (lastChar === ')') {
      let closing = 0;
      for (let i = m[1] - 1; i >= m[0]; i--) {
        if (line[i] === ')') closing++;
        else if (line[i] === '(') closing--;
      }
      if (closing > 0) m[1] -= closing;
    } else if (lastChar === ';') {
      let i = m[1] - 2;
      for (; i >= m[0]; i--) {
        if (!/[A-Za-z0-9]/.test(line[i])) break;
      }
      if (i !== m[1] - 2 && line[i] === '&') m[1] -= m[1] - i;
    }
  }
  if (!m) {
    if (isASCIIPunct(line[0])) return null;
    email = true;
    const stop = findEmailIndex(line);
    if (stop < 0) return null;
    const at = line.indexOf('@');
    if (!line.slice(at, stop - 1).includes('.')) return null;
    m = [0, stop];
    if (line[m[1] - 1] === '.') m[1]--;
    if (m[1] < line.length && (line[m[1]] === '-' || line[m[1]] === '_')) return null;
  }
  let i = m[1] - 1;
  for (; i > 0; i--) {
    if (!'?!.,:*_~'.includes(line[i])) break;
  }
  i++;
  const label = line.slice(0, i);
  return {
    content: label,
    destination: email ? `mailto:${label}` : protocol ? `${protocol}://${label}` : label,
    end: pos + i,
  };
}

/**
 * Parse inline content into `parent`, following goldmark's inline parser:
 * text is scanned line by line; at every trigger character (spaces and the
 * punctuation that starts an inline construct) the pending text is merged
 * into the previous Text node, and the text left at the end of each line
 * becomes a new Text node carrying the soft/hard line break.
 *
 * `inLinkLabel` disables linkify inside link text, as upstream does.
 */
function parseInlines(
  text: string,
  parent: Node,
  context: ParseContext,
  options: { inLinkLabel?: boolean; lineEnd?: boolean } = {},
): void {
  const state: InlineState = { text, context, delimiters: [], openLabels: 0 };
  parseInlineRange(state, parent, 0, text.length, options.inLinkLabel ?? false, options.lineEnd ?? true);
  processDelimiters(state);
  finalizeInlines(parent, state);
}

function parseInlineRange(
  state: InlineState,
  parent: Node,
  from: number,
  to: number,
  inLinkLabel: boolean,
  lineEnd: boolean,
): void {
  const { text, context } = state;
  let pos = from;

  while (pos < to) {
    // retry: start scanning the rest of the current line
    const nl = text.indexOf('\n', pos);
    const lineStop = nl === -1 || nl >= to ? to : nl;
    const hasNewLine = lineStop < to;
    let contentStop = lineStop;
    let hard = false;
    let visible = false;
    if (hasNewLine) {
      const line = text.slice(pos, lineStop);
      if (line.endsWith('\\') && !line.endsWith('\\\\')) {
        contentStop -= 1;
        hard = true;
        visible = true;
      } else if (line.endsWith('  ')) {
        contentStop -= 2;
        hard = true;
      }
    }

    const start = pos;
    let segmentStart = pos;
    let escaped = false;
    let produced = false;

    for (let i = pos; i < contentStop; i++) {
      const c = text[i];
      const isSpace = isInlineSpace(c);
      const isPunct = isASCIIPunct(c);
      const atStart = i === start;
      if ((isPunct && !escaped) || isSpace || atStart) {
        const trigger = isSpace || (atStart && !isPunct) ? ' ' : c;
        if (hasInlineParser(trigger, context)) {
          if (!atStart) {
            mergeOrAppendTextSegment(parent, segmentStart, i);
            segmentStart = i;
          }
          const end = tryInlineParsers(state, parent, i, trigger, lineStop, to, inLinkLabel);
          if (end !== null) {
            pos = end;
            produced = true;
            break;
          }
        }
      }
      if (escaped) {
        escaped = false;
        continue;
      }
      if (c === '\\') {
        escaped = true;
        continue;
      }
      escaped = false;
    }
    if (produced) continue;

    // the rest of the line becomes a Text node
    let stop = contentStop;
    if (!(hard && visible)) {
      while (stop > segmentStart && isSpaceRune(text[stop - 1])) stop--;
    }
    if (!lineEnd && !hasNewLine) {
      if (stop > segmentStart) mergeOrAppendTextSegment(parent, segmentStart, stop);
      pos = to;
      continue;
    }
    if (hasNewLine || segmentStart < stop) {
      const node = newTextSegment(parent, segmentStart, stop);
      if (hard) node.hardBreak = true;
      else if (hasNewLine) node.softBreak = true;
    }
    pos = hasNewLine ? lineStop + 1 : to;
  }
}

function hasInlineParser(trigger: string, context: ParseContext): boolean {
  return ' *_~(`<[!]'.includes(trigger) || (context.emoji && trigger === ':');
}

/**
 * Run the inline parsers registered for `trigger` at `pos`. Returns the
 * position after the parsed node, or null when every parser declined.
 */
function tryInlineParsers(
  state: InlineState,
  parent: Node,
  pos: number,
  trigger: string,
  lineStop: number,
  to: number,
  inLinkLabel: boolean,
): number | null {
  const { text, context } = state;
  const before = pos > 0 ? String.fromCodePoint(text.codePointAt(pos - 1) ?? 10) : '\n';
  const c = text[pos];

  switch (trigger) {
    case '*':
    case '_': {
      const d = scanDelimiter(text, pos, before);
      if (!d) break;
      appendDelimiter(state, parent, d, pos);
      return pos + d.originalLength;
    }
    case '~': {
      const d = scanDelimiter(text, pos, before);
      if (d && d.originalLength <= 2 && before !== '~') {
        appendDelimiter(state, parent, d, pos);
        return pos + d.originalLength;
      }
      break;
    }
    case '`': {
      const span = parseCodeSpan(text.slice(0, to), pos);
      if (span) {
        const codeSpan = createNode(NodeKind.CodeSpan, parent);
        codeSpan.literal = span.content;
        return span.end;
      }
      let run = pos;
      while (run < to && text[run] === '`') run++;
      newTextSegment(parent, pos, run);
      return run;
    }
    case '<': {
      const autolink = parseAutolink(text.slice(0, to), pos);
      if (autolink) {
        const node = createNode(NodeKind.AutoLink, parent);
        node.literal = autolink.content;
        node.destination = autolink.destination;
        return autolink.end;
      }
      const html = parseHtmlInline(text.slice(0, to), pos);
      if (html) {
        const node = createNode(NodeKind.HtmlInline, parent);
        node.literal = html.content;
        return html.end;
      }
      return null;
    }
    case '!':
    case '[': {
      const isImage = c === '!';
      if (isImage && text[pos + 1] !== '[') return null;
      const bracket = isImage ? pos + 1 : pos;
      const link = parseLinkOrImage(text.slice(0, to), bracket, isImage, context);
      if (link) {
        const node = createNode(isImage ? NodeKind.Image : NodeKind.Link, parent);
        node.destination = link.destination;
        node.title = link.title || undefined;
        const contentStart = bracket + 1;
        const inner: InlineState = { text, context, delimiters: [], openLabels: 0 };
        parseInlineRange(inner, node, contentStart, contentStart + link.text.length, true, false);
        processDelimiters(inner);
        return link.end;
      }
      // An unmatched opener stays a separate node until the block closes,
      // and keeps linkify off until a ']' closes it (IsInLinkLabel).
      state.openLabels++;
      const node: Node = {
        kind: DELIMITER_KIND, children: [], parent, prevSibling: null, nextSibling: null,
      };
      const length = isImage ? 2 : 1;
      node.segStart = pos;
      node.segStop = pos + length;
      parent.children.push(node);
      state.delimiters.push({
        node, char: '[', length, originalLength: length, canOpen: false, canClose: false, label: true,
      });
      return pos + length;
    }
    case ':': {
      const shortcode = /^:([+\-\w]+):/.exec(text.slice(pos, to));
      if (shortcode && hasEmoji(shortcode[1])) {
        const emoji = createNode(NodeKind.Emoji, parent);
        emoji.literal = getEmoji(shortcode[1]);
        return pos + shortcode[0].length;
      }
      return null;
    }
    default:
      break;
  }

  if (c === ']' && state.openLabels > 0) state.openLabels--;

  // linkify (registered for ' ', '*', '_', '~', '(' and line starts)
  if (inLinkLabel || state.openLabels > 0 || !' *_~('.includes(trigger)) return null;
  const consumes = ' *_~('.includes(c) ? 1 : 0;
  const match = linkifyAt(text, pos + consumes, lineStop);
  if (!match) return null;
  if (consumes) mergeOrAppendTextSegment(parent, pos, pos + 1);
  const node = createNode(NodeKind.AutoLink, parent);
  node.literal = match.content;
  node.destination = match.destination;
  return match.end;
}

function appendDelimiter(state: InlineState, parent: Node, d: Delimiter, pos: number): void {
  d.node.parent = parent;
  d.node.segStart = pos;
  d.node.segStop = pos + d.originalLength;
  parent.children.push(d.node);
  state.delimiters.push(d);
}

/** Compute Text literals from their spans and relink sibling pointers. */
function finalizeInlines(node: Node, state: InlineState): void {
  let prev: Node | null = null;
  for (const child of node.children) {
    child.parent = node;
    child.prevSibling = prev;
    child.nextSibling = null;
    if (prev) prev.nextSibling = child;
    prev = child;
    if (child.kind === NodeKind.Text && child.segStart !== undefined) {
      child.literal = decodeEntities(segmentText(child, state));
      delete child.segStart;
      delete child.segStop;
    }
    finalizeInlines(child, state);
  }
}

/** html.UnescapeString for the entities this parser knows. */
export function decodeEntities(s: string): string {
  if (!s.includes('&')) return s;
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === '&') {
      const entity = parseEntity(s, i);
      if (entity) {
        out += entity.decoded;
        i = entity.end;
        continue;
      }
    }
    out += s[i];
    i++;
  }
  return out;
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

function parseLinkOrImage(
  text: string,
  pos: number,
  _isImage: boolean,
  context: ParseContext,
): LinkResult | null {
  if (text[pos] !== '[') return null;

  let depth = 0;
  let index = pos;
  while (index < text.length) {
    if (text[index] === '\\' && index + 1 < text.length) {
      index += 2;
      continue;
    }
    if (text[index] === '[') depth++;
    if (text[index] === ']') {
      depth--;
      if (depth === 0) break;
    }
    index++;
  }
  if (index >= text.length || depth !== 0) return null;

  const linkText = text.slice(pos + 1, index);
  index++;

  if (text[index] !== '(') {
    let label = linkText;
    let end = index;
    if (text[index] === '[') {
      const close = text.indexOf(']', index + 1);
      if (close < 0) return null;
      label = text.slice(index + 1, close) || linkText;
      end = close + 1;
    }
    const reference = context.references.get(normalizeReferenceLabel(label));
    if (!reference) return null;
    return {
      text: linkText,
      destination: reference.destination,
      title: reference.title,
      end,
    };
  }

  index++;
  while (index < text.length && (text[index] === ' ' || text[index] === '\n')) index++;

  let destination = '';
  if (text[index] === '<') {
    const closeAngle = text.indexOf('>', index + 1);
    if (closeAngle < 0) return null;
    destination = text.slice(index + 1, closeAngle);
    index = closeAngle + 1;
  } else {
    let parenDepth = 0;
    const start = index;
    while (index < text.length) {
      const char = text[index];
      if (char === '\\' && index + 1 < text.length) {
        index += 2;
        continue;
      }
      if (char === '(') {
        parenDepth++;
      } else if (char === ')') {
        if (parenDepth === 0) break;
        parenDepth--;
      } else if (char === ' ' || char === '\n') {
        break;
      }
      index++;
    }
    destination = text.slice(start, index);
  }

  while (index < text.length && (text[index] === ' ' || text[index] === '\n')) index++;

  let title = '';
  if (text[index] === '"' || text[index] === "'" || text[index] === '(') {
    const open = text[index];
    const close = open === '(' ? ')' : open;
    index++;
    const start = index;
    while (index < text.length && text[index] !== close) {
      if (text[index] === '\\' && index + 1 < text.length) index++;
      index++;
    }
    if (index >= text.length) return null;
    title = text.slice(start, index);
    index++;
  }

  while (index < text.length && (text[index] === ' ' || text[index] === '\n')) index++;
  if (text[index] !== ')') return null;

  return {
    text: linkText,
    destination: unescapeMarkdown(destination),
    title: unescapeMarkdown(title),
    end: index + 1,
  };
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

function normalizeReferenceLabel(label: string): string {
  return unescapeMarkdown(label).trim().replace(/\s+/g, ' ').toLowerCase();
}

function unescapeMarkdown(value: string): string {
  return value.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1');
}

function decodeReferenceText(value: string): string {
  return unescapeMarkdown(value).replace(
    /&(?:#(x[0-9A-Fa-f]+|\d+)|([A-Za-z][A-Za-z0-9]+));/g,
    (entity, numeric: string | undefined, named: string | undefined) => {
      if (numeric) {
        const codePoint = numeric[0].toLowerCase() === 'x'
          ? Number.parseInt(numeric.slice(1), 16)
          : Number.parseInt(numeric, 10);
        if (Number.isSafeInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff) {
          return String.fromCodePoint(codePoint);
        }
        return entity;
      }
      return decodeNamedEntity(named ?? '') ?? entity;
    },
  );
}

function extractLinkReferences(lines: string[]): Map<string, LinkReference> {
  const references = new Map<string, LinkReference>();
  let fenceCharacter = '';
  let fenceLength = 0;
  let htmlEnd: RegExp | null = null;
  let htmlUntilBlank = false;

  const stripQuotes = (value: string): { prefix: string; text: string } => {
    let text = value;
    let prefix = '';
    while (true) {
      const quote = /^ {0,3}>[ \t]?/.exec(text);
      if (!quote) return { prefix, text };
      prefix += quote[0];
      text = text.slice(quote[0].length);
    }
  };

  const candidateAt = (index: number): { prefix: string; text: string } =>
    stripQuotes(lines[index]);

  for (let index = 0; index < lines.length; index++) {
    const { prefix, text } = candidateAt(index);
    const fence = /^ {0,3}(`{3,}|~{3,})/.exec(text);
    if (fenceCharacter) {
      if (
        fence &&
        fence[1][0] === fenceCharacter &&
        fence[1].length >= fenceLength
      ) {
        fenceCharacter = '';
        fenceLength = 0;
      }
      continue;
    }
    if (htmlEnd) {
      if (htmlEnd.test(text)) htmlEnd = null;
      continue;
    }
    if (htmlUntilBlank) {
      if (isBlankLine(text)) htmlUntilBlank = false;
      continue;
    }
    if (fence) {
      fenceCharacter = fence[1][0];
      fenceLength = fence[1].length;
      continue;
    }

    const htmlStart = classifyHtmlBlockStart(text);
    if (htmlStart) {
      htmlEnd = htmlStart.end;
      htmlUntilBlank = htmlStart.untilBlank;
      continue;
    }


    const match = /^ {0,3}\[([^\]]+)\]:[ \t]*(?:<([^>\n]+)>|(\S+))(?:[ \t]+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?[ \t]*$/.exec(text);
    if (!match) continue;

    let title = match[4] ?? match[5] ?? match[6] ?? '';
    if (!title && index + 1 < lines.length) {
      const next = candidateAt(index + 1);
      if (next.prefix === prefix) {
        const titleLine = /^ {1,3}(?:"([^"]*)"|'([^']*)'|\(([^)]*)\))[ \t]*$/.exec(next.text);
        if (titleLine) {
          title = titleLine[1] ?? titleLine[2] ?? titleLine[3] ?? '';
          lines[index + 1] = next.prefix.trimEnd();
        }
      }
    }

    const label = normalizeReferenceLabel(match[1]);
    if (!references.has(label)) {
      references.set(label, {
        destination: decodeReferenceText(match[2] ?? match[3]),
        title: decodeReferenceText(title),
      });
    }
    lines[index] = prefix.trimEnd();
  }

  return references;
}

// ─── Main parse() function ──────────────────────────────────────────────────

/**
 * Parse a markdown string into an AST.
 * @param markdown - The markdown source text
 * @returns The root Document node
 */
export function parse(markdown: string, options: ParseOptions = {}): Node {
  const root: Node = {
    kind: NodeKind.Document,
    children: [],
    parent: null,
    prevSibling: null,
    nextSibling: null,
  };

  const normalized = markdown.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  const context: ParseContext = {
    emoji: options.emoji ?? false,
    references: extractLinkReferences(lines),
  };
  parseBlocks(lines, root, context);
  return root;
}
