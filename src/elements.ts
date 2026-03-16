// Elements — All element types + newElement factory + isChildNode
// Port of charmbracelet/glamour/ansi/elements.go and individual element files

import type { Node } from './parser.js';
import type { RenderContext } from './context.js';
import type {
  StyleConfig,
  StyleBlock,
  StylePrimitive,
  StyleCodeBlock,
  StyleList,
  StyleTable,
} from './style.js';
import {
  cascadeStyle,
  cascadeStyles,
  cascadeStylePrimitive,
  cascadeStylePrimitives,
  toStylePrimitive,
} from './style.js';
import { BlockElement } from './blockelement.js';
import { renderText, buildSGR, wordWrap, stringWidth, stripAnsi, stripHTML, formatTemplate } from './baseelement.js';
import { MarginWriter, IndentWriter } from './writers.js';

// ─── Element Interface ─────────────────────────────────────────────────────────

/** ElementRenderer is called when entering a markdown node. */
export interface ElementRenderer {
  render(ctx: RenderContext): string;
}

/** ElementFinisher is called when leaving a markdown node. */
export interface ElementFinisher {
  finish(ctx: RenderContext): string;
}

/**
 * An Element is used to instruct the renderer how to handle individual
 * markdown nodes.
 */
export interface Element {
  entering?: string;
  exiting?: string;
  renderer?: ElementRenderer;
  finisher?: ElementFinisher;
}

// ─── Base Element (inline text renderer) ────────────────────────────────────────

/**
 * BaseElement renders a token with styling. Used for inline text, list bullets,
 * strikethrough text, thematic breaks, HTML blocks, etc.
 */
export class BaseElement implements ElementRenderer {
  token: string;
  prefix: string;
  style: StylePrimitive;

  constructor(token: string = '', style: StylePrimitive = {}, prefix: string = '') {
    this.token = token;
    this.prefix = prefix;
    this.style = style;
  }

  render(_ctx: RenderContext): string {
    const style = this.style;
    let out = '';

    // Apply prefix
    if (style.prefix || this.prefix) {
      const pfx = this.prefix + (style.prefix || '');
      out += renderText(pfx, style);
    }

    // Apply format template if present
    let token = this.token;
    if (style.format) {
      token = formatTemplate(style.format, token);
    }

    // Apply text transformations
    if (style.upper) {
      token = token.toUpperCase();
    } else if (style.lower) {
      token = token.toLowerCase();
    } else if (style.title) {
      token = token.replace(/\b\w/g, (c) => c.toUpperCase());
    }

    // Render with SGR styling
    out += renderText(token, style);

    // Apply suffix
    if (style.suffix) {
      out += renderText(style.suffix, style);
    }

    return out;
  }
}

// ─── HeadingElement ────────────────────────────────────────────────────────────

/** HeadingElement renders h1-h6 headings. */
export class HeadingElement implements ElementRenderer, ElementFinisher {
  level: number;
  first: boolean;

  constructor(level: number, first: boolean) {
    this.level = level;
    this.first = first;
  }

  render(ctx: RenderContext): string {
    const bs = ctx.blockStack;
    const styles = ctx.options.styles;
    let rules: StyleBlock = styles.heading || {};

    // Cascade the specific heading level style
    switch (this.level) {
      case 1: if (styles.h1) rules = cascadeStyles(rules, styles.h1); break;
      case 2: if (styles.h2) rules = cascadeStyles(rules, styles.h2); break;
      case 3: if (styles.h3) rules = cascadeStyles(rules, styles.h3); break;
      case 4: if (styles.h4) rules = cascadeStyles(rules, styles.h4); break;
      case 5: if (styles.h5) rules = cascadeStyles(rules, styles.h5); break;
      case 6: if (styles.h6) rules = cascadeStyles(rules, styles.h6); break;
    }

    let out = '';
    if (!this.first) {
      out += renderText('\n', toStylePrimitive(bs.current().style));
    }

    // Push a new block frame
    const cascaded = cascadeStyle(bs.current().style, rules, false);
    bs.push({
      block: '',
      style: cascaded,
      margin: false,
      newline: false,
    });

    // Render block prefix and prefix
    if (rules.block_prefix) {
      out += renderText(rules.block_prefix, toStylePrimitive(bs.parent().style));
    }
    if (rules.prefix) {
      bs.writeToCurrentBlock(renderText(rules.prefix, toStylePrimitive(bs.current().style)));
    }

    return out;
  }

  finish(ctx: RenderContext): string {
    const bs = ctx.blockStack;
    const rules = bs.current().style;
    const width = bs.width(ctx.options.wordWrap);

    // Word-wrap the heading content
    let content = bs.current().block;
    if (width > 0) {
      content = wordWrap(content, width);
    }

    // Apply margin
    const marginSize = rules.margin || 0;
    const mw = new MarginWriter(marginSize);
    mw.write(content);
    const flow = mw.flush();

    let out = flow;

    // Suffix and block suffix
    if (rules.suffix) {
      out += renderText(rules.suffix, toStylePrimitive(rules));
    }
    if (rules.block_suffix) {
      out += renderText(rules.block_suffix, toStylePrimitive(bs.parent().style));
    }

    bs.resetCurrentBlock();
    bs.pop();
    return out;
  }
}

// ─── ParagraphElement ──────────────────────────────────────────────────────────

/** ParagraphElement renders paragraphs with word-wrapping. */
export class ParagraphElement implements ElementRenderer, ElementFinisher {
  first: boolean;

  constructor(first: boolean = false) {
    this.first = first;
  }

  render(ctx: RenderContext): string {
    const bs = ctx.blockStack;
    const styles = ctx.options.styles;
    const rules: StyleBlock = styles.paragraph || {};

    let out = '';
    if (!this.first) {
      out += '\n';
    }

    const cascaded = cascadeStyle(bs.current().style, rules, false);
    bs.push({
      block: '',
      style: cascaded,
      margin: true,
      newline: false,
    });

    if (rules.block_prefix) {
      out += renderText(rules.block_prefix, toStylePrimitive(bs.parent().style));
    }
    if (rules.prefix) {
      bs.writeToCurrentBlock(renderText(rules.prefix, toStylePrimitive(bs.current().style)));
    }

    return out;
  }

  finish(ctx: RenderContext): string {
    const bs = ctx.blockStack;
    const rules = bs.current().style;
    const width = bs.width(ctx.options.wordWrap);

    let content = bs.current().block.trim();
    if (content.length === 0) {
      bs.resetCurrentBlock();
      bs.pop();
      return '';
    }

    // Collapse newlines unless preserveNewLines is set
    if (!ctx.options.preserveNewLines) {
      content = content.replace(/\n/g, ' ');
    }

    // Word-wrap
    if (width > 0) {
      content = wordWrap(content, width);
    }

    // Apply margin
    const marginSize = rules.margin || 0;
    const mw = new MarginWriter(marginSize);
    mw.write(content + '\n');
    let out = mw.flush();

    // Suffix and block suffix
    if (rules.suffix) {
      out += renderText(rules.suffix, toStylePrimitive(rules));
    }
    if (rules.block_suffix) {
      out += renderText(rules.block_suffix, toStylePrimitive(bs.parent().style));
    }

    bs.resetCurrentBlock();
    bs.pop();
    return out;
  }
}

// ─── EmphasisElement ───────────────────────────────────────────────────────────

/** EmphasisElement renders bold/italic emphasis. */
export class EmphasisElement implements ElementRenderer {
  level: number;
  children: ElementRenderer[];

  constructor(level: number, children: ElementRenderer[]) {
    this.level = level;
    this.children = children;
  }

  render(ctx: RenderContext): string {
    const style = this.level > 1
      ? (ctx.options.styles.strong || {})
      : (ctx.options.styles.emph || {});

    let out = '';
    for (const child of this.children) {
      out += child.render(ctx);
    }

    // Apply emphasis styling to the rendered children
    return renderText(out, style);
  }
}

// ─── LinkElement ───────────────────────────────────────────────────────────────

/** Generate a simple hash for OSC 8 link IDs. */
function fnvHash(s: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

/** Create OSC 8 hyperlink escape sequences. */
function makeHyperlink(url: string): { hyperlink: string; resetHyperlink: string; valid: boolean } {
  if (!url || url.startsWith('#')) {
    return { hyperlink: '', resetHyperlink: '', valid: false };
  }

  const id = fnvHash(url);
  const hyperlink = `\x1b]8;id=${id};${url}\x07`;
  const resetHyperlink = `\x1b]8;;\x07`;

  return { hyperlink, resetHyperlink, valid: true };
}

/** Resolve a relative URL against a base URL. */
function resolveRelativeURL(baseURL: string, rel: string): string {
  if (!baseURL || !rel) return rel;
  try {
    const u = new URL(rel);
    if (u.protocol) return rel; // absolute
  } catch {
    // relative — resolve against base
  }
  try {
    const base = new URL(baseURL);
    return new URL(rel, base).toString();
  } catch {
    return rel;
  }
}

/** LinkElement renders hyperlinks. */
export class LinkElement implements ElementRenderer {
  baseURL: string;
  url: string;
  children: ElementRenderer[];
  skipText: boolean;
  skipHref: boolean;

  constructor(
    url: string,
    children: ElementRenderer[],
    baseURL: string = '',
    skipText: boolean = false,
    skipHref: boolean = false,
  ) {
    this.url = url;
    this.children = children;
    this.baseURL = baseURL;
    this.skipText = skipText;
    this.skipHref = skipHref;
  }

  render(ctx: RenderContext): string {
    const { hyperlink, resetHyperlink, valid } = makeHyperlink(this.url);
    let out = '';

    // Render the text part
    if (!this.skipText) {
      const linkTextStyle = ctx.options.styles.link_text || {};
      for (const child of this.children) {
        let childText = child.render(ctx);
        // Wrap child text with hyperlink if available
        if (valid && ctx.options.hyperlinks) {
          childText = hyperlink + childText + resetHyperlink;
        }
        out += renderText(childText, linkTextStyle);
      }
    }

    // Render the href part
    if (!this.skipHref && valid) {
      const linkStyle = ctx.options.styles.link || {};
      const prefix = !this.skipText ? ' ' : '';
      const resolvedURL = resolveRelativeURL(this.baseURL, this.url);
      let token = resolvedURL;
      if (ctx.options.hyperlinks) {
        token = hyperlink + resolvedURL + resetHyperlink;
      }
      const el = new BaseElement(token, linkStyle, prefix);
      out += el.render(ctx);
    }

    return out;
  }
}

// ─── ImageElement ──────────────────────────────────────────────────────────────

/** ImageElement renders images (as text with optional URL). */
export class ImageElement implements ElementRenderer {
  text: string;
  baseURL: string;
  url: string;
  textOnly: boolean;

  constructor(text: string, url: string, baseURL: string = '', textOnly: boolean = false) {
    this.text = text;
    this.url = url;
    this.baseURL = baseURL;
    this.textOnly = textOnly;
  }

  render(ctx: RenderContext): string {
    const { hyperlink, resetHyperlink } = makeHyperlink(this.url);
    let out = '';

    const imageTextStyle = ctx.options.styles.image_text || {};

    if (this.text.length > 0) {
      let token = this.text;
      if (ctx.options.hyperlinks) {
        token = hyperlink + this.text + resetHyperlink;
      }
      const el = new BaseElement(token, imageTextStyle);
      out += el.render(ctx);
    }

    if (this.textOnly) return out;

    if (this.url.length > 0) {
      const imageStyle = ctx.options.styles.image || {};
      const resolvedURL = resolveRelativeURL(this.baseURL, this.url);
      let token = resolvedURL;
      if (ctx.options.hyperlinks) {
        token = hyperlink + resolvedURL + resetHyperlink;
      }
      const el = new BaseElement(token, imageStyle, ' ');
      out += el.render(ctx);
    }

    return out;
  }
}

// ─── ItemElement ───────────────────────────────────────────────────────────────

/** ItemElement renders list items (ordered and unordered). */
export class ItemElement implements ElementRenderer {
  isOrdered: boolean;
  enumeration: number;

  constructor(isOrdered: boolean, enumeration: number = 0) {
    this.isOrdered = isOrdered;
    this.enumeration = enumeration;
  }

  render(ctx: RenderContext): string {
    if (this.isOrdered) {
      const el = new BaseElement('', ctx.options.styles.enumeration || {}, String(this.enumeration));
      return el.render(ctx);
    } else {
      const el = new BaseElement('', ctx.options.styles.item || {});
      return el.render(ctx);
    }
  }
}

// ─── TaskElement ───────────────────────────────────────────────────────────────

/** TaskElement renders task/checkbox items. */
export class TaskElement implements ElementRenderer {
  checked: boolean;

  constructor(checked: boolean) {
    this.checked = checked;
  }

  render(ctx: RenderContext): string {
    const task = ctx.options.styles.task || {};
    const prefix = this.checked ? (task.ticked || '[✓] ') : (task.unticked || '[✗] ');
    const style: StylePrimitive = {
      color: task.color,
      background_color: task.background_color,
      bold: task.bold,
      italic: task.italic,
      underline: task.underline,
      crossed_out: task.crossed_out,
      faint: task.faint,
    };
    const el = new BaseElement('', style, prefix);
    return el.render(ctx);
  }
}

// ─── CodeBlockElement ──────────────────────────────────────────────────────────

/** CodeBlockElement renders fenced code blocks. */
export class CodeBlockElement implements ElementRenderer {
  code: string;
  language: string;

  constructor(code: string, language: string = '') {
    this.code = code;
    this.language = language;
  }

  render(ctx: RenderContext): string {
    const bs = ctx.blockStack;
    const rules: StyleCodeBlock = (ctx.options.styles.code_block || {}) as StyleCodeBlock;

    const indentation = rules.indent || 0;
    const margin = rules.margin || 0;

    // Calculate indent prefix
    const indentStr = ' '.repeat(indentation + margin);
    let out = '';

    // Block prefix
    if (rules.block_prefix) {
      out += renderText(rules.block_prefix, toStylePrimitive(bs.current().style));
    }

    // Render code content with indentation
    const lines = this.code.split('\n');
    const codePrim = toStylePrimitive(rules);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip trailing empty line (from trailing \n)
      if (i === lines.length - 1 && line === '') continue;
      out += indentStr + renderText(line, codePrim) + '\n';
    }

    // Block suffix
    if (rules.block_suffix) {
      out += renderText(rules.block_suffix, toStylePrimitive(bs.current().style));
    }

    return out;
  }
}

// ─── CodeSpanElement ───────────────────────────────────────────────────────────

/** CodeSpanElement renders inline code spans. */
export class CodeSpanElement implements ElementRenderer {
  text: string;
  style: StylePrimitive;

  constructor(text: string, style: StylePrimitive) {
    this.text = text;
    this.style = style;
  }

  render(_ctx: RenderContext): string {
    const content = (this.style.prefix || '') + this.text + (this.style.suffix || '');
    return renderText(content, this.style);
  }
}

// ─── StrikethroughElement ─────────────────────────────────────────────────────

/** StrikethroughElement renders strikethrough text. */
export class StrikethroughElement implements ElementRenderer {
  text: string;

  constructor(text: string) {
    this.text = text;
  }

  render(ctx: RenderContext): string {
    const style = ctx.options.styles.strikethrough || {};
    const el = new BaseElement(this.text, style);
    return el.render(ctx);
  }
}

// ─── HRElement ─────────────────────────────────────────────────────────────────

/** HRElement renders horizontal rules (thematic breaks). */
export class HRElement implements ElementRenderer {
  render(ctx: RenderContext): string {
    const bs = ctx.blockStack;
    const style = ctx.options.styles.hr || {};
    const width = bs.width(ctx.options.wordWrap);

    // Fill width with the format character or default "─"
    const fillChar = style.format || '─';
    const repeatCount = width > 0 ? Math.floor(width / stringWidth(fillChar)) : 80;
    const hrLine = fillChar.repeat(repeatCount);

    // Remove the format field from the style passed to BaseElement
    // since we've already used it to build the repeated line
    const { format: _, ...hrStyle } = style;
    const el = new BaseElement(hrLine, hrStyle);
    return el.render(ctx);
  }
}

// ─── TableElement ──────────────────────────────────────────────────────────────

/** TableCellElement renders a single cell in a table row. */
export class TableCellElement implements ElementRenderer {
  children: ElementRenderer[];
  head: boolean;

  constructor(children: ElementRenderer[], head: boolean = false) {
    this.children = children;
    this.head = head;
  }

  render(ctx: RenderContext): string {
    const tableStyle = ctx.options.styles.table || {};
    const style = toStylePrimitive(tableStyle);

    let content = '';
    for (const child of this.children) {
      content += child.render(ctx);
    }

    // Render with table style
    content = renderText(content, style);

    // Add to the appropriate context accumulator
    if (this.head) {
      ctx.table.header.push(content);
    } else {
      ctx.table.row.push(content);
    }

    return '';
  }
}

/** TableRowElement finishes a table row. */
export class TableRowElement implements ElementFinisher {
  finish(ctx: RenderContext): string {
    if (ctx.table.row.length > 0) {
      ctx.table.rows.push([...ctx.table.row]);
      ctx.table.row = [];
    }
    return '';
  }
}

/** TableHeadElement finishes the table header. */
export class TableHeadElement implements ElementFinisher {
  finish(_ctx: RenderContext): string {
    // Header is already accumulated in ctx.table.header
    return '';
  }
}

/** TableElement renders tables with aligned columns. */
export class TableElement implements ElementRenderer, ElementFinisher {
  render(ctx: RenderContext): string {
    // Reset table context
    ctx.table = {
      header: [],
      row: [],
      rows: [],
      alignments: [],
    };
    return '';
  }

  finish(ctx: RenderContext): string {
    const bs = ctx.blockStack;
    const rules: StyleTable = (ctx.options.styles.table || {}) as StyleTable;

    // Collect all rows (header + body)
    const allRows: string[][] = [];
    if (ctx.table.header.length > 0) {
      allRows.push(ctx.table.header);
    }
    for (const row of ctx.table.rows) {
      allRows.push(row);
    }

    if (allRows.length === 0) {
      ctx.table = { header: [], row: [], rows: [], alignments: [] };
      return '';
    }

    // Compute column widths
    const numCols = Math.max(...allRows.map((r) => r.length));
    const colWidths: number[] = new Array(numCols).fill(0);

    for (const row of allRows) {
      for (let col = 0; col < numCols; col++) {
        const cell = row[col] || '';
        const w = stringWidth(stripAnsi(cell));
        if (w > colWidths[col]) colWidths[col] = w;
      }
    }

    // Separators
    const colSep = rules.column_separator || '│';
    const rowSep = rules.row_separator || '─';
    const centerSep = rules.center_separator || '┼';

    // Build separator line
    const sepParts: string[] = [];
    for (let col = 0; col < numCols; col++) {
      sepParts.push(rowSep.repeat(colWidths[col] + 2)); // +2 for padding
    }
    const separatorLine = sepParts.join(centerSep);

    // Build table output
    let out = '';
    const indentation = (rules.indent || 0) + (rules.margin || 0);
    const indentStr = ' '.repeat(indentation);

    // Block prefix
    if (rules.block_prefix) {
      out += renderText(rules.block_prefix, toStylePrimitive(rules));
    }

    for (let rowIdx = 0; rowIdx < allRows.length; rowIdx++) {
      const row = allRows[rowIdx];
      let line = indentStr + colSep;

      for (let col = 0; col < numCols; col++) {
        const cell = row[col] || '';
        const cellPlain = stripAnsi(cell);
        const cellWidth = stringWidth(cellPlain);
        const padSize = colWidths[col] - cellWidth;
        const alignment = ctx.table.alignments[col] || 'left';

        let padded: string;
        if (alignment === 'right') {
          padded = ' ' + ' '.repeat(padSize) + cell + ' ';
        } else if (alignment === 'center') {
          const leftPad = Math.floor(padSize / 2);
          const rightPad = padSize - leftPad;
          padded = ' ' + ' '.repeat(leftPad) + cell + ' '.repeat(rightPad) + ' ';
        } else {
          padded = ' ' + cell + ' '.repeat(padSize) + ' ';
        }
        line += padded + colSep;
      }

      out += line + '\n';

      // Add separator after header
      if (rowIdx === 0 && ctx.table.header.length > 0) {
        out += indentStr + colSep + separatorLine + colSep + '\n';
      }
    }

    // Block suffix
    if (rules.block_suffix) {
      out += renderText(rules.block_suffix, toStylePrimitive(rules));
    }

    // Reset table context
    ctx.table = { header: [], row: [], rows: [], alignments: [] };

    return out;
  }
}

// ─── isChildNode ───────────────────────────────────────────────────────────────

/**
 * Checks if a node is a "child" node that should be rendered by its parent
 * rather than the walker. These nodes are nested inside parent elements that
 * render them directly (CodeSpan, Link, Image, Emphasis, Strikethrough, TableCell).
 */
export function isChildNode(node: Node): boolean {
  let parent = node.parent;
  while (parent) {
    switch (parent.kind) {
      case 'code_span':
      case 'link':
      case 'auto_link':
      case 'image':
      case 'emphasis':
      case 'strikethrough':
      case 'table_cell':
        return true;
    }
    parent = parent.parent;
  }
  return false;
}

// ─── newElement factory ────────────────────────────────────────────────────────

/**
 * Creates the appropriate Element for a given AST node.
 * Maps NodeKind → Element with the proper renderer/finisher.
 */
export function newElement(node: Node, ctx: RenderContext): Element {
  const styles = ctx.options.styles;
  const bs = ctx.blockStack;

  switch (node.kind) {
    // ── Document ──
    case 'document': {
      const be = new BlockElement(styles.document || {}, true);
      return {
        renderer: { render: (c) => { be.render(c); return ''; } },
        finisher: { finish: (c) => { be.finish(c); return ''; } },
      };
    }

    // ── Heading ──
    case 'heading': {
      const level = node.level || 1;
      const first = !node.prevSibling;
      const he = new HeadingElement(level, first);
      return {
        renderer: he,
        finisher: he,
      };
    }

    // ── Paragraph ──
    case 'paragraph': {
      // If inside a list item, skip paragraph wrapping
      if (node.parent && node.parent.kind === 'list_item') {
        return {};
      }
      const first = !node.prevSibling;
      const pe = new ParagraphElement(first);
      return {
        renderer: pe,
        finisher: pe,
      };
    }

    // ── Blockquote ──
    case 'block_quote': {
      const bqStyle = cascadeStyle(
        bs.current().style,
        styles.block_quote || {},
        false,
      );
      const be = new BlockElement(bqStyle, true);
      return {
        entering: '\n',
        renderer: { render: (c) => { be.render(c); return ''; } },
        finisher: { finish: (c) => { be.finish(c); return ''; } },
      };
    }

    // ── List ──
    case 'list': {
      const listStyle: StyleList = { ...(styles.list || {}) };
      if (listStyle.indent === undefined) {
        listStyle.indent = 0;
      }

      // Check if this is a nested list
      let n = node.parent;
      while (n) {
        if (n.kind === 'list') {
          listStyle.indent = listStyle.level_indent || 2;
          break;
        }
        n = n.parent;
      }

      const s = cascadeStyle(bs.current().style, listStyle, false);
      const be = new BlockElement(s, true, true);
      return {
        entering: '\n',
        renderer: { render: (c) => { be.render(c); return ''; } },
        finisher: { finish: (c) => { be.finish(c); return ''; } },
      };
    }

    // ── List Item ──
    case 'list_item': {
      // Count position in list
      let enumeration = 1;
      let n: Node | undefined = node;
      while (n && n.prevSibling && n.prevSibling.kind === 'list_item') {
        enumeration++;
        n = n.prevSibling;
      }

      const isOrdered = node.parent?.ordered || false;
      if (isOrdered) {
        const start = node.parent?.start || 1;
        if (start !== 1) {
          enumeration += start - 1;
        }
      }

      // Determine post text
      let post = '\n';
      const lastChild = node.children?.[node.children.length - 1];
      if ((lastChild && lastChild.kind === 'list') || !node.nextSibling) {
        post = '';
      }

      // Check for task checkbox
      const firstChild = node.children?.[0];
      const firstGrandchild = firstChild?.children?.[0];
      if (firstGrandchild && firstGrandchild.kind === 'task_checkbox') {
        return {
          exiting: post,
          renderer: new TaskElement(firstGrandchild.checked || false),
        };
      }

      return {
        exiting: post,
        renderer: new ItemElement(isOrdered, isOrdered ? enumeration : 0),
      };
    }

    // ── Text ──
    case 'text': {
      let s = node.literal || '';

      if (node.hardBreak || node.softBreak) {
        s += '\n';
      }

      return {
        renderer: new BaseElement(s, styles.text || {}),
      };
    }

    // ── Emphasis ──
    case 'emphasis': {
      const children: ElementRenderer[] = [];
      if (node.children) {
        for (const child of node.children) {
          const childEl = newElement(child, ctx);
          if (childEl.renderer) {
            children.push(childEl.renderer);
          }
        }
      }
      return {
        renderer: new EmphasisElement(node.level || 1, children),
      };
    }

    // ── Strikethrough ──
    case 'strikethrough': {
      const text = node.literal || '';
      return {
        renderer: new StrikethroughElement(text),
      };
    }

    // ── Thematic Break (HR) ──
    case 'thematic_break': {
      return {
        renderer: new HRElement(),
      };
    }

    // ── Link ──
    case 'link': {
      const children: ElementRenderer[] = [];
      if (node.children) {
        for (const child of node.children) {
          const childEl = newElement(child, ctx);
          if (childEl.renderer) {
            children.push(childEl.renderer);
          }
        }
      }

      if (children.length === 0 && node.literal) {
        children.push(new BaseElement(node.literal));
      }

      return {
        renderer: new LinkElement(
          node.destination || '',
          children,
          '',    // baseURL — could be passed via ctx.options
          false,
          false,
        ),
      };
    }

    // ── AutoLink ──
    case 'auto_link': {
      const url = node.destination || node.literal || '';
      const children: ElementRenderer[] = [];
      if (node.children) {
        for (const child of node.children) {
          const childEl = newElement(child, ctx);
          if (childEl.renderer) {
            children.push(childEl.renderer);
          }
        }
      }
      if (children.length === 0) {
        children.push(new BaseElement(url));
      }

      return {
        renderer: new LinkElement(url, children),
      };
    }

    // ── Image ──
    case 'image': {
      const text = node.literal || node.title || '';
      return {
        renderer: new ImageElement(text, node.destination || ''),
      };
    }

    // ── Code Block (fenced and indented) ──
    case 'code_block':
    case 'fenced_code_block': {
      const code = node.literal || '';
      const lang = node.info || '';
      return {
        entering: '\n',
        renderer: new CodeBlockElement(code, lang),
      };
    }

    // ── Code Span ──
    case 'code_span': {
      const text = node.literal || '';
      const codeStyle = cascadeStyle(
        bs.current().style,
        styles.code || {},
        false,
      );
      return {
        renderer: new CodeSpanElement(text, toStylePrimitive(codeStyle)),
      };
    }

    // ── Table ──
    case 'table': {
      const te = new TableElement();

      // Extract alignments from node if available
      if (node.alignments) {
        ctx.table.alignments = node.alignments;
      }

      return {
        entering: '\n',
        exiting: '\n',
        renderer: te,
        finisher: te,
      };
    }

    case 'table_header': {
      return {
        finisher: new TableHeadElement(),
      };
    }

    case 'table_row': {
      return {
        finisher: new TableRowElement(),
      };
    }

    case 'table_cell': {
      const children: ElementRenderer[] = [];
      if (node.children) {
        for (const child of node.children) {
          const childEl = newElement(child, ctx);
          if (childEl.renderer) {
            children.push(childEl.renderer);
          }
        }
      }

      const head = node.parent?.kind === 'table_header';
      return {
        renderer: new TableCellElement(children, head),
      };
    }

    // ── HTML Block ──
    case 'html_block': {
      const content = ctx.sanitizeHTML(node.literal || '', true);
      const htmlStyle = styles.html_block || {};
      return {
        renderer: new BaseElement(content, toStylePrimitive(htmlStyle)),
      };
    }

    // ── Raw HTML (inline) ──
    case 'html_inline': {
      const content = ctx.sanitizeHTML(node.literal || '', true);
      const htmlStyle = styles.html_span || {};
      return {
        renderer: new BaseElement(content, toStylePrimitive(htmlStyle)),
      };
    }

    // ── Task Checkbox (handled by list_item) ──
    case 'task_checkbox': {
      return {};
    }

    // ── Text Block ──
    case 'text_block': {
      return {};
    }

    // ── Softbreak ──
    case 'softbreak': {
      return {
        renderer: new BaseElement('\n'),
      };
    }

    // ── Hardbreak ──
    case 'hardbreak': {
      return {
        renderer: new BaseElement('\n'),
      };
    }

    // ── Unknown ──
    default: {
      return {};
    }
  }
}
