// Elements — All element types + newElement factory + isChildNode
// Port of charmbracelet/glamour/ansi/elements.go and individual element files

import hljs from 'highlight.js';

import type { Node } from './parser.js';
import type { RenderContext, TableLink, TableLinkType } from './context.js';
import type {
  StyleBlock,
  StylePrimitive,
  StyleCodeBlock,
  StyleList,
  StyleTable,
  Chroma,
} from './style.js';
import {
  cascadeStyle,
  cascadeStyles,
  cascadeStylePrimitive,
  cascadeStylePrimitives,
  toStylePrimitive,
} from './style.js';
import {
  renderText,
  renderElement,
  wordWrap,
  stringWidth,
} from './baseelement.js';
import { MarginWriter } from './writers.js';
import { BlockElement } from './blockelement.js';
import { detect } from './autolink.js';

function renderStyled(
  ctx: RenderContext,
  text: string,
  style: StylePrimitive,
): string {
  return renderText(text, style, ctx.options.colorProfile);
}

// ─── Element Interface ─────────────────────────────────────────────────────────

/** ElementRenderer is called when entering a markdown node. */
export interface ElementRenderer {
  render(ctx: RenderContext): string;
}


/** Renderer that supports a caller-provided style override. */
export interface StyleOverriderElementRenderer extends ElementRenderer {
  styleOverrideRender(ctx: RenderContext, style: StylePrimitive): string;
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
export class BaseElement implements StyleOverriderElementRenderer {
  token: string;
  prefix: string;
  suffix: string;
  style: StylePrimitive;

  constructor(
    token: string = '',
    style: StylePrimitive = {},
    prefix: string = '',
    suffix: string = '',
  ) {
    this.token = token;
    this.prefix = prefix;
    this.suffix = suffix;
    this.style = style;
  }

  render(ctx: RenderContext): string {
    const parentStyle = toStylePrimitive(ctx.blockStack.current().style);
    const style = cascadeStylePrimitive(parentStyle, this.style, false);
    return renderElement(
      this.token,
      this.prefix,
      this.suffix,
      parentStyle,
      style,
      ctx.options.colorProfile,
    );
  }

  styleOverrideRender(ctx: RenderContext, override: StylePrimitive): string {
    const parent = toStylePrimitive(ctx.blockStack.current().style);
    const parentStyle = cascadeStylePrimitives(parent, override);
    const ownStyle = cascadeStylePrimitives(
      ctx.blockStack.withStyle(this.style),
      override,
    );
    return renderElement(
      this.token,
      this.prefix,
      this.suffix,
      parentStyle,
      ownStyle,
      ctx.options.colorProfile,
    );
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
      out += renderStyled(ctx, '\n', toStylePrimitive(bs.current().style));
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
      out += renderStyled(ctx, rules.block_prefix, toStylePrimitive(bs.parent().style));
    }
    if (rules.prefix) {
      bs.writeToCurrentBlock(renderStyled(ctx, rules.prefix, toStylePrimitive(bs.current().style)));
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
      out += renderStyled(ctx, rules.suffix, toStylePrimitive(rules));
    }
    if (rules.block_suffix) {
      out += renderStyled(ctx, rules.block_suffix, toStylePrimitive(bs.parent().style));
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
      out += renderStyled(ctx, rules.block_prefix, toStylePrimitive(bs.parent().style));
    }
    if (rules.prefix) {
      bs.writeToCurrentBlock(renderStyled(ctx, rules.prefix, toStylePrimitive(bs.current().style)));
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
      out += renderStyled(ctx, rules.suffix, toStylePrimitive(rules));
    }
    if (rules.block_suffix) {
      out += renderStyled(ctx, rules.block_suffix, toStylePrimitive(bs.parent().style));
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
    return renderStyled(ctx, out, style);
  }
}

// ─── LinkElement ───────────────────────────────────────────────────────────────

function fnvHash(s: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(s)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** Create OSC 8 hyperlink escape sequences. */
function makeHyperlink(url: string): { hyperlink: string; resetHyperlink: string; valid: boolean } {
  if (!url || url.startsWith('#')) {
    return { hyperlink: '', resetHyperlink: '', valid: false };
  }
  const id = fnvHash(url);
  return {
    hyperlink: `\x1b]8;id=${id};${url}\x07`,
    resetHyperlink: '\x1b]8;;\x07',
    valid: true,
  };
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
        let childText: string;
        if (
          'styleOverrideRender' in child &&
          typeof child.styleOverrideRender === 'function'
        ) {
          childText = child.styleOverrideRender(ctx, linkTextStyle);
        } else {
          childText = renderStyled(ctx, child.render(ctx), linkTextStyle);
        }
        if (valid && ctx.options.hyperlinks) {
          childText = hyperlink + childText + resetHyperlink;
        }
        out += childText;
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
    const prefix = this.checked ? (task.ticked || '[✓] ') : (task.unticked || '[ ] ');
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


const CHROMA_STYLE_BY_CLASS: Record<string, keyof Chroma> = {
  'hljs-comment': 'comment',
  'hljs-meta': 'comment_preproc',
  'hljs-keyword': 'keyword',
  'hljs-built_in': 'name_builtin',
  'hljs-type': 'keyword_type',
  'hljs-operator': 'operator',
  'hljs-punctuation': 'punctuation',
  'hljs-title': 'name',
  'hljs-attr': 'name_attribute',
  'hljs-attribute': 'name_attribute',
  'hljs-tag': 'name_tag',
  'hljs-variable': 'name',
  'hljs-property': 'name_attribute',
  'hljs-params': 'name',
  'hljs-number': 'literal_number',
  'hljs-literal': 'literal',
  'hljs-string': 'literal_string',
  'hljs-regexp': 'literal_string',
  'hljs-deletion': 'generic_deleted',
  'hljs-addition': 'generic_inserted',
  'hljs-emphasis': 'generic_emph',
  'hljs-strong': 'generic_strong',
  'hljs-section': 'generic_subheading',
};

function highlightCode(
  code: string,
  language: string,
  rules: StyleCodeBlock,
  ctx: RenderContext,
): string {
  const chroma = rules.chroma;
  if (!chroma) return renderStyled(ctx, code, toStylePrimitive(rules));

  const formatter = ctx.options.chromaFormatter ?? 'terminal256';
  const formatterProfiles: Record<string, number> = {
    terminal: 4,
    terminal8: 4,
    terminal16: 1,
    terminal256: 2,
    terminal16m: 3,
  };
  const formatterProfile = formatterProfiles[formatter];
  if (formatterProfile === undefined) {
    throw new Error(`glamour: unknown chroma formatter ${formatter}`);
  }
  const profile = ctx.options.colorProfile <= 0
    ? 0
    : formatterProfile === 4
      ? 4
      : Math.min(ctx.options.colorProfile, formatterProfile);

  const lexer = language.trim().split(/\s+/, 1)[0];
  let highlighted: string;
  try {
    highlighted = lexer && hljs.getLanguage(lexer)
      ? hljs.highlight(code, { language: lexer, ignoreIllegals: true }).value
      : hljs.highlightAuto(code).value;
  } catch {
    return renderText(code, chroma.text ?? toStylePrimitive(rules), profile);
  }

  const base = cascadeStylePrimitives(
    chroma.background ?? {},
    chroma.text ?? toStylePrimitive(rules),
  );
  const styles: StylePrimitive[] = [base];
  let output = '';
  const tokens = /<span class="([^"]+)">|<\/span>|([^<]+)/g;
  let token: RegExpExecArray | null;
  while ((token = tokens.exec(highlighted)) !== null) {
    if (token[1]) {
      const classes = token[1].split(/\s+/);
      let key: keyof Chroma | undefined = classes.includes('function_')
        ? 'name_function'
        : classes.includes('class_')
          ? 'name_class'
          : undefined;
      if (!key) {
        for (const className of classes) {
          const candidate = CHROMA_STYLE_BY_CLASS[className];
          if (candidate) {
            key = candidate;
            break;
          }
        }
      }
      styles.push(cascadeStylePrimitives(styles[styles.length - 1], key ? chroma[key] ?? {} : {}));
    } else if (token[0] === '</span>') {
      if (styles.length > 1) styles.pop();
    } else if (token[2]) {
      const decoded = token[2].replace(
        /&(lt|gt|amp|quot|#x27);/g,
        (_entity, name: string) => ({
          lt: '<',
          gt: '>',
          amp: '&',
          quot: '"',
          '#x27': "'",
        } as Record<string, string>)[name],
      );
      const trailingNewlines = decoded.match(/\n+$/)?.[0] ?? '';
      const content = trailingNewlines
        ? decoded.slice(0, -trailingNewlines.length)
        : decoded;
      output += renderText(content, styles[styles.length - 1], profile);
      output += trailingNewlines;
    }
  }
  return output;
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
      out += renderStyled(ctx, rules.block_prefix, toStylePrimitive(bs.current().style));
    }

    const highlighted = highlightCode(this.code, this.language, rules, ctx);
    const lines = highlighted.split('\n');
    for (let index = 0; index < lines.length; index++) {
      if (index === lines.length - 1 && lines[index] === '') continue;
      out += indentStr + lines[index] + '\n';
    }

    // Block suffix
    if (rules.block_suffix) {
      out += renderStyled(ctx, rules.block_suffix, toStylePrimitive(bs.current().style));
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
  render(ctx: RenderContext): string {
    const content = (this.style.prefix || '') + this.text + (this.style.suffix || '');
    return renderStyled(ctx, content, this.style);
  }
}

// ─── StrikethroughElement ─────────────────────────────────────────────────────

/** StrikethroughElement renders strikethrough text. */
export class StrikethroughElement implements ElementRenderer {
  constructor(
    public text: string = '',
    public children: ElementRenderer[] = [],
  ) {}

  render(ctx: RenderContext): string {
    const style = ctx.options.styles.strikethrough || {};
    const content = this.children.length > 0
      ? this.children.map((child) => child.render(ctx)).join('')
      : this.text;
    return new BaseElement(content, style).render(ctx);
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
  constructor(
    public children: ElementRenderer[],
    public head: boolean = false,
  ) {}

  render(ctx: RenderContext): string {
    const style = toStylePrimitive(ctx.options.styles.table || {});
    let content = '';
    for (const child of this.children) {
      if (
        'styleOverrideRender' in child &&
        typeof child.styleOverrideRender === 'function'
      ) {
        content += child.styleOverrideRender(ctx, style);
      } else {
        content += renderStyled(ctx, child.render(ctx), style);
      }
    }
    if (this.head) ctx.table.header.push(content);
    else ctx.table.row.push(content);
    return '';
  }
}

export class TableRowElement implements ElementFinisher {
  finish(ctx: RenderContext): string {
    if (ctx.table.row.length > 0) {
      ctx.table.rows.push(ctx.table.row);
      ctx.table.row = [];
    }
    return '';
  }
}

export class TableHeadElement implements ElementFinisher {
  finish(_ctx: RenderContext): string {
    return '';
  }
}

function truncateAnsi(text: string, width: number): string {
  if (stringWidth(text) <= width) return text;
  if (width <= 0) return '';
  if (width === 1) return '…';

  const parts = text.match(/\x1b\[[0-9;]*[A-Za-z]|\x1b\].*?(?:\x1b\\|\x07)|[\s\S]/g) ?? [];
  let output = '';
  let visible = 0;
  let hyperlinkOpen = false;
  let hyperlinkTerminator = '\x07';
  for (const part of parts) {
    if (part.startsWith('\x1b')) {
      output += part;
      if (part.startsWith('\x1b]8;')) {
        hyperlinkOpen = !part.startsWith('\x1b]8;;');
        hyperlinkTerminator = part.endsWith('\x07') ? '\x07' : '\x1b\\';
      }
      continue;
    }
    const partWidth = stringWidth(part);
    if (visible + partWidth > width - 1) break;
    output += part;
    visible += partWidth;
  }
  const sgrReset = output.includes('\x1b[') ? '\x1b[0m' : '';
  const hyperlinkReset = hyperlinkOpen
    ? `\x1b]8;;${hyperlinkTerminator}`
    : '';
  return output + '…' + hyperlinkReset + sgrReset;
}

function tableLinkKey(link: TableLink): string {
  return `${link.type}\0${link.href}\0${link.title}\0${link.content}`;
}

function renderTableFooter(ctx: RenderContext, termWidth: number): string {
  let output = '';
  const renderList = (links: TableLink[]): void => {
    const numberWidth = String(links.length).length;
    for (let index = 0; index < links.length; index++) {
      const link = links[index];
      const position = index + 1;
      const padding = ' '.repeat(numberWidth - String(position).length);
      let label: string;
      if (link.type === 'image') {
        const imageText = ctx.options.styles.image_text || {};
        label = new BaseElement(
          padding + link.content,
          { ...imageText, prefix: `[${position}]: ${imageText.prefix ?? ''}` },
        ).render(ctx);
      } else {
        label = new BaseElement(
          `${padding}[${position}]: ${link.content}`,
          ctx.options.styles.link_text || {},
        ).render(ctx);
      }

      const hrefStyle = link.type === 'image'
        ? ctx.options.styles.image || {}
        : ctx.options.styles.link || {};
      const maxHrefWidth = Math.max(termWidth - stringWidth(label) - 1, 0);
      const visibleHref = truncateAnsi(link.href, maxHrefWidth);
      let href = visibleHref;
      if (ctx.options.hyperlinks && visibleHref && !link.href.startsWith('#')) {
        const hyperlink = makeHyperlink(link.href);
        href = hyperlink.hyperlink + visibleHref + hyperlink.resetHyperlink;
      }
      let renderedHref = new BaseElement(href, hrefStyle).render(ctx);
      if (renderedHref) renderedHref = ctx.protectSegment(renderedHref);
      output += `\n${label}${renderedHref ? ` ${renderedHref}` : ''}`;
    }
  };

  if (ctx.table.links.length > 0) output += '\n';
  renderList(ctx.table.links);
  if (ctx.table.images.length > 0) output += '\n';
  renderList(ctx.table.images);
  return output;
}

/** Render a GFM table constrained to the current terminal width. */
export class TableElement implements ElementRenderer, ElementFinisher {
  constructor(
    private readonly alignments: ('left' | 'center' | 'right' | 'none')[] = [],
  ) {}

  render(ctx: RenderContext): string {
    ctx.table = {
      header: [],
      row: [],
      rows: [],
      alignments: [...this.alignments],
      links: [],
      images: [],
    };
    const rules = ctx.options.styles.table || {};
    let output = '';
    if (rules.block_prefix) {
      output += renderStyled(ctx, rules.block_prefix, toStylePrimitive(ctx.blockStack.current().style));
    }
    if (rules.prefix) output += renderStyled(ctx, rules.prefix, toStylePrimitive(rules));
    return output;
  }

  finish(ctx: RenderContext): string {
    const rules: StyleTable = ctx.options.styles.table || {};
    const allRows = ctx.table.header.length > 0
      ? [ctx.table.header, ...ctx.table.rows]
      : [...ctx.table.rows];
    if (allRows.length === 0) return '';

    const columns = Math.max(
      ctx.table.alignments.length,
      ...allRows.map((row) => row.length),
    );
    const padding = rules.margin ?? 1;
    const indentation = (rules.indent ?? 0) + (rules.margin ?? 0);
    const columnSeparator = rules.column_separator ?? '│';
    const rowSeparator = rules.row_separator ?? '─';
    const centerSeparator = rules.center_separator ?? '┼';
    const separatorWidth = stringWidth(columnSeparator) * Math.max(columns - 1, 0);
    const availableWidth = ctx.options.wordWrap > 0
      ? Math.max(columns, ctx.blockStack.width(ctx.options.wordWrap) - indentation - separatorWidth)
      : Number.POSITIVE_INFINITY;

    const widths = new Array<number>(columns).fill(1 + padding * 2);
    for (const row of allRows) {
      for (let column = 0; column < columns; column++) {
        widths[column] = Math.max(
          widths[column],
          stringWidth(row[column] ?? '') + padding * 2,
        );
      }
    }

    if (Number.isFinite(availableWidth)) {
      let total = widths.reduce((sum, value) => sum + value, 0);
      while (total > availableWidth) {
        let widest = 0;
        for (let column = 1; column < columns; column++) {
          if (widths[column] > widths[widest]) widest = column;
        }
        const minimum = 1 + padding * 2;
        if (widths[widest] <= minimum) break;
        widths[widest]--;
        total--;
      }
      for (let column = 0; total < availableWidth; column = (column + 1) % columns) {
        widths[column]++;
        total++;
      }
    }

    const indent = ' '.repeat(indentation);
    let output = '';
    for (let rowIndex = 0; rowIndex < allRows.length; rowIndex++) {
      const renderedCells: string[][] = [];
      let rowHeight = 1;
      for (let column = 0; column < columns; column++) {
        const contentWidth = Math.max(widths[column] - padding * 2, 1);
        const cell = allRows[rowIndex][column] ?? '';
        const rendered = ctx.options.tableWrap
          ? wordWrap(cell, contentWidth)
          : truncateAnsi(cell, contentWidth);
        const lines = rendered.split('\n');
        renderedCells.push(lines);
        rowHeight = Math.max(rowHeight, lines.length);
      }

      for (let lineIndex = 0; lineIndex < rowHeight; lineIndex++) {
        const cells: string[] = [];
        for (let column = 0; column < columns; column++) {
          const cell = renderedCells[column][lineIndex] ?? '';
          const missing = Math.max(widths[column] - padding * 2 - stringWidth(cell), 0);
          const alignment = ctx.table.alignments[column] ?? 'none';
          let left = 0;
          let right = missing;
          if (alignment === 'right') {
            left = missing;
            right = 0;
          } else if (alignment === 'center') {
            left = Math.floor(missing / 2);
            right = missing - left;
          }
          cells.push(
            ' '.repeat(padding + left) +
            cell +
            ' '.repeat(padding + right),
          );
        }
        output += indent + cells.join(columnSeparator) + '\n';
      }

      if (rowIndex === 0 && ctx.table.header.length > 0) {
        output += indent + widths
          .map((width) => rowSeparator.repeat(width))
          .join(centerSeparator) + '\n';
      }
    }

    output = output.replace(/\n$/, '');
    if (rules.suffix) output += renderStyled(ctx, rules.suffix, toStylePrimitive(rules));
    if (rules.block_suffix) {
      output += renderStyled(
        ctx,
        rules.block_suffix,
        toStylePrimitive(ctx.blockStack.current().style),
      );
    }
    output += renderTableFooter(ctx, ctx.blockStack.width(ctx.options.wordWrap));
    return output;
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


function nodePlainText(node: Node): string {
  if (node.literal !== undefined) return node.literal;
  let text = '';
  for (const child of node.children) text += nodePlainText(child);
  return text;
}

function isInsideTable(node: Node): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      parent.kind === 'table' ||
      parent.kind === 'table_header' ||
      parent.kind === 'table_row' ||
      parent.kind === 'table_cell'
    ) {
      return true;
    }
  }
  return false;
}

function collectNestedTableImages(node: Node, ctx: RenderContext): void {
  for (const child of node.children) {
    if (child.kind === 'image') {
      addTableLink(
        ctx,
        'image',
        child.destination || '',
        child.title || '',
        nodePlainText(child) || linkDomain(child.destination || ''),
      );
    }
    collectNestedTableImages(child, ctx);
  }
}

function addTableLink(
  ctx: RenderContext,
  type: TableLinkType,
  href: string,
  title: string,
  content: string,
): number {
  const link: TableLink = { type, href, title, content };
  const list = type === 'image' ? ctx.table.images : ctx.table.links;
  const key = tableLinkKey(link);
  let index = list.findIndex((existing) => tableLinkKey(existing) === key);
  if (index < 0) {
    list.push(link);
    index = list.length - 1;
  }
  return index + 1;
}

function linkDomain(href: string): string {
  try {
    return new URL(href).hostname || 'link';
  } catch {
    return 'link';
  }
}
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
        finisher: { finish: (c) => be.finish(c) },
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
        finisher: { finish: (c) => be.finish(c) },
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
        finisher: { finish: (c) => be.finish(c) },
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
      const checkbox = firstChild?.kind === 'task_checkbox'
        ? firstChild
        : firstChild?.children?.[0];
      if (checkbox?.kind === 'task_checkbox') {
        return {
          exiting: post,
          renderer: new TaskElement(checkbox.checked || false),
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
      const children: ElementRenderer[] = [];
      for (const child of node.children) {
        const renderer = newElement(child, ctx).renderer;
        if (renderer) children.push(renderer);
      }
      return {
        renderer: new StrikethroughElement(node.literal || '', children),
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
      const href = node.destination || '';
      const content = nodePlainText(node);
      const footerLink = isInsideTable(node) && !ctx.options.inlineTableLinks;
      const children: ElementRenderer[] = [];
      if (footerLink) {
        collectNestedTableImages(node, ctx);
        const position = addTableLink(
          ctx,
          'regular',
          href,
          node.title || '',
          content,
        );
        children.push(new BaseElement(`${content}[${position}]`));
      } else {
        for (const child of node.children) {
          const renderer = newElement(child, ctx).renderer;
          if (renderer) children.push(renderer);
        }
      }
      return {
        renderer: new LinkElement(
          href,
          children,
          ctx.options.baseURL ?? '',
          false,
          footerLink,
        ),
      };
    }

    case 'auto_link': {
      const href = node.destination || node.literal || '';
      const visible = node.literal || href.replace(/^mailto:/i, '');
      const footerLink = isInsideTable(node) && !ctx.options.inlineTableLinks;
      if (footerLink) {
        const [shortened, detected] = detect(href);
        const content = detected ? shortened : linkDomain(href);
        const position = addTableLink(ctx, 'auto', href, '', content);
        return {
          renderer: new LinkElement(
            href,
            [new BaseElement(`${content}[${position}]`)],
            '',
            false,
            true,
          ),
        };
      }

      const email = /^mailto:/i.test(href);
      return {
        renderer: new LinkElement(
          href,
          [new BaseElement(visible)],
          '',
          !email,
          email,
        ),
      };
    }

    case 'image': {
      const href = node.destination || '';
      let content = node.literal || nodePlainText(node);
      const footerImage = isInsideTable(node) && !ctx.options.inlineTableLinks;
      if (footerImage) {
        if (!content) content = linkDomain(href);
        const position = addTableLink(
          ctx,
          'image',
          href,
          node.title || '',
          content,
        );
        content += `[${position}]`;
      }
      return {
        renderer: new ImageElement(
          content,
          href,
          ctx.options.baseURL ?? '',
          footerImage,
        ),
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
      const te = new TableElement(node.alignments || []);
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

      let parent = node.parent;
      while (parent && parent.kind !== 'table_header' && parent.kind !== 'table') {
        parent = parent.parent;
      }
      const head = parent?.kind === 'table_header';
      return {
        renderer: new TableCellElement(children, head),
      };
    }


    case 'definition_list': {
      const definitionStyle = cascadeStyle(
        bs.current().style,
        styles.definition_list || {},
        false,
      );
      const block = new BlockElement(definitionStyle, true, true);
      return {
        renderer: { render: (c) => { block.render(c); return ''; } },
        finisher: { finish: (c) => block.finish(c) },
      };
    }

    case 'definition_term':
      return {
        entering: '\n',
        renderer: new BaseElement('', styles.definition_term || {}),
      };

    case 'definition_description':
      return {
        exiting: '\n',
        renderer: new BaseElement('', styles.definition_description || {}),
      };

    case 'emoji':
      return { renderer: new BaseElement(node.literal || '') };
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
