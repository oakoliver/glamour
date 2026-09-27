// Elements — All element types + newElement factory + isChildNode
// Port of charmbracelet/glamour/ansi/elements.go and the individual element
// files (heading.go, paragraph.go, emphasis.go, link.go, image.go,
// listitem.go, task.go, codeblock.go, codespan.go, table.go, table_links.go).
//
// Upstream renderers write to an io.Writer `w`. Here `render`/`finish` return
// the string upstream writes to `w`; writes upstream sends elsewhere (the
// current block buffer, table state) happen as side effects on the context.

import hljs from 'highlight.js';

import { decodeEntities, type Node } from './parser.js';
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
  cascadeStylePrimitives,
  toStylePrimitive,
} from './style.js';
import { renderText, renderElement } from './baseelement.js';
import {
  StringWriter,
  colorSGR,
  resetHyperlink as ansiResetHyperlink,
  setHyperlink,
  stringWidth,
  truncate,
  wrap,
  type Writer,
} from './ansi.js';
import { IndentWriter, MarginWriter } from './writers.js';
import { BlockElement } from './blockelement.js';
import { Table, normalBorder, type CellStyle } from './table.js';
import { TTY_TABLES } from './chroma.js';
import { detect } from './autolink.js';

function renderStyled(
  ctx: RenderContext,
  text: string,
  style: StylePrimitive,
): string {
  return renderText(text, style, ctx.options.colorProfile);
}

function currentPrimitive(ctx: RenderContext): StylePrimitive {
  return toStylePrimitive(ctx.blockStack.current().style);
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

function isStyleOverrider(r: ElementRenderer): r is StyleOverriderElementRenderer {
  return typeof (r as Partial<StyleOverriderElementRenderer>).styleOverrideRender === 'function';
}

// ─── Base Element (inline text renderer) ────────────────────────────────────────

/**
 * BaseElement renders a styled primitive element: inline text, list bullets,
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
    const st1 = currentPrimitive(ctx);
    const st2 = ctx.blockStack.with(this.style);
    return this.doRender(ctx, st1, st2);
  }

  /** Render with the element's style overridden by `style` (e.g. strong/emph). */
  styleOverrideRender(ctx: RenderContext, style: StylePrimitive): string {
    const st1 = cascadeStylePrimitives(currentPrimitive(ctx), style);
    const st2 = cascadeStylePrimitives(ctx.blockStack.with(this.style), style);
    return this.doRender(ctx, st1, st2);
  }

  private doRender(ctx: RenderContext, st1: StylePrimitive, st2: StylePrimitive): string {
    return renderElement(this.token, this.prefix, this.suffix, st1, st2, ctx.options.colorProfile);
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
    const levels = [styles.h1, styles.h2, styles.h3, styles.h4, styles.h5, styles.h6];
    let rules: StyleBlock = styles.heading || {};
    if (this.level >= 1 && this.level <= 6) {
      rules = cascadeStyles(rules, levels[this.level - 1] || {});
    }

    let out = '';
    if (!this.first) out += renderStyled(ctx, '\n', currentPrimitive(ctx));

    bs.push({
      block: '',
      style: cascadeStyle(bs.current().style, rules, false),
      margin: false,
      newline: false,
    });

    out += renderStyled(ctx, rules.block_prefix ?? '', toStylePrimitive(bs.parent().style));
    bs.writeToCurrentBlock(renderStyled(ctx, rules.prefix ?? '', currentPrimitive(ctx)));
    return out;
  }

  finish(ctx: RenderContext): string {
    const bs = ctx.blockStack;
    const rules = bs.current().style;
    const w = new StringWriter();
    const mw = new MarginWriter(ctx, w, rules);

    mw.write(wrap(bs.current().block, bs.width(ctx.options.wordWrap), ''));

    w.write(renderStyled(ctx, rules.suffix ?? '', toStylePrimitive(rules)));
    w.write(renderStyled(ctx, rules.block_suffix ?? '', toStylePrimitive(bs.parent().style)));

    bs.resetCurrentBlock();
    bs.pop();
    mw.close();
    return w.value;
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
    const rules: StyleBlock = ctx.options.styles.paragraph || {};

    let out = '';
    if (!this.first) out += '\n';

    bs.push({
      block: '',
      style: cascadeStyle(bs.current().style, rules, false),
      margin: false,
      newline: false,
    });

    out += renderStyled(ctx, rules.block_prefix ?? '', toStylePrimitive(bs.parent().style));
    bs.writeToCurrentBlock(renderStyled(ctx, rules.prefix ?? '', currentPrimitive(ctx)));
    return out;
  }

  finish(ctx: RenderContext): string {
    const bs = ctx.blockStack;
    const rules = bs.current().style;
    const w = new StringWriter();
    const mw = new MarginWriter(ctx, w, rules);

    if (bs.current().block.trim().length > 0) {
      let blk = bs.current().block;
      if (!ctx.options.preserveNewLines) blk = blk.replace(/\n/g, ' ');
      mw.write(wrap(blk, bs.width(ctx.options.wordWrap), ''));
      mw.write('\n');
    }

    w.write(renderStyled(ctx, rules.suffix ?? '', currentPrimitive(ctx)));
    w.write(renderStyled(ctx, rules.block_suffix ?? '', toStylePrimitive(bs.parent().style)));

    bs.resetCurrentBlock();
    bs.pop();
    mw.close();
    return w.value;
  }
}

// ─── EmphasisElement ───────────────────────────────────────────────────────────

/** EmphasisElement renders emphasis (level 1) and strong emphasis (level 2). */
export class EmphasisElement implements StyleOverriderElementRenderer {
  level: number;
  children: ElementRenderer[];

  constructor(level: number, children: ElementRenderer[]) {
    this.level = level;
    this.children = children;
  }

  private baseStyle(ctx: RenderContext): StylePrimitive {
    return (this.level > 1 ? ctx.options.styles.strong : ctx.options.styles.emph) || {};
  }

  render(ctx: RenderContext): string {
    return this.doRender(ctx, this.baseStyle(ctx));
  }

  styleOverrideRender(ctx: RenderContext, style: StylePrimitive): string {
    return this.doRender(ctx, cascadeStylePrimitives(this.baseStyle(ctx), style));
  }

  private doRender(ctx: RenderContext, style: StylePrimitive): string {
    let out = '';
    for (const child of this.children) {
      out += isStyleOverrider(child) ? child.styleOverrideRender(ctx, style) : child.render(ctx);
    }
    return out;
  }
}

// ─── LinkElement ───────────────────────────────────────────────────────────────

/** 32-bit FNV-1a, as hash/fnv.New32a. */
function fnvHash(s: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(s)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** Whether url.Parse accepts the link and it is more than a bare #anchor. */
function isValidLink(link: string): boolean {
  if (/[\x00-\x1f\x7f]/.test(link)) return false;
  if (/%(?![0-9a-fA-F]{2})/.test(link)) return false;
  const hash = link.indexOf('#');
  if (hash !== 0) return true;
  let fragment = link.slice(1);
  try {
    fragment = decodeURIComponent(fragment);
  } catch {
    return false;
  }
  return `#${fragment}` !== link;
}

/** makeHyperlink: the OSC 8 hyperlink token for a URL. */
function makeHyperlink(
  link: string,
  ctx: RenderContext,
): { hyperlink: string; resetHyperlink: string; valid: boolean } {
  const valid = isValidLink(link);
  if (!valid || !ctx.options.hyperlinks) return { hyperlink: '', resetHyperlink: '', valid };
  return {
    hyperlink: setHyperlink(link, `id=${fnvHash(link)}`),
    resetHyperlink: ansiResetHyperlink(),
    valid,
  };
}

/** url.resolvePath: merge a reference path into a base path, removing dot segments. */
function resolvePath(base: string, ref: string): string {
  let full: string;
  if (ref === '') full = base;
  else if (ref[0] !== '/') full = base.slice(0, base.lastIndexOf('/') + 1) + ref;
  else full = ref;
  if (full === '') return '';

  const out: string[] = [];
  const segments = full.split('/');
  segments.forEach((segment, i) => {
    const last = i === segments.length - 1;
    if (segment === '.') {
      if (last) out.push('');
    } else if (segment === '..') {
      if (out.length > 1 || (out.length === 1 && out[0] !== '')) out.pop();
      if (last) out.push('');
    } else {
      out.push(segment);
    }
  });
  return '/' + out.join('/').replace(/^\/+/, '');
}

/**
 * resolveRelativeURL: resolve a link against the base URL the way Go's
 * url.ResolveReference does (so relative paths resolve even without a base,
 * e.g. "docs/a.md" becomes "/docs/a.md").
 */
function resolveRelativeURL(baseURL: string, rel: string): string {
  if (!isValidLink(rel) && !rel.startsWith('#')) return rel;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rel)) return rel;

  const ref = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(rel) as RegExpExecArray;
  const refPath = ref[1].replace(/^\//, ''); // strings.TrimPrefix(u.Path, "/")
  const refQuery = ref[2] ?? '';
  const refFragment = ref[3] ?? '';
  const trimmed = refPath + refQuery + refFragment;

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(baseURL)) {
    try {
      return new URL(trimmed, baseURL).toString();
    } catch {
      return rel;
    }
  }

  const base = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(baseURL) as RegExpExecArray;
  let query = refQuery;
  let fragment = refFragment;
  if (refPath === '' && refQuery === '') {
    query = base[2] ?? '';
    if (refFragment === '') fragment = base[3] ?? '';
  }
  return escapedPath(resolvePath(base[1], refPath)) + query + fragment;
}

/** url.URL.EscapedPath: keep a validly encoded path, otherwise escape it for a path. */
function escapedPath(path: string): string {
  if (/^[A-Za-z0-9\-_.~$&+,/:;=@!'()*[\]%]*$/.test(path)) return path;
  let out = '';
  for (const byte of new TextEncoder().encode(path)) {
    const c = String.fromCharCode(byte);
    out += /[A-Za-z0-9\-_.~$&+,/:;=@]/.test(c) ? c : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return out;
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
    const link = makeHyperlink(this.url, ctx);
    let out = '';
    if (!this.skipText) out += this.renderTextPart(ctx, link);
    if (!this.skipHref) out += this.renderHrefPart(ctx, link);
    return out;
  }

  private renderTextPart(
    ctx: RenderContext,
    link: { hyperlink: string; resetHyperlink: string },
  ): string {
    const linkText = ctx.options.styles.link_text || {};
    let out = '';
    for (const child of this.children) {
      if (isStyleOverrider(child)) {
        out += link.hyperlink + child.styleOverrideRender(ctx, linkText) + link.resetHyperlink;
      } else {
        const token = link.hyperlink + child.render(ctx) + link.resetHyperlink;
        out += new BaseElement(token, linkText).render(ctx);
      }
    }
    return out;
  }

  private renderHrefPart(
    ctx: RenderContext,
    link: { hyperlink: string; resetHyperlink: string; valid: boolean },
  ): string {
    if (!link.valid) return '';
    const prefix = this.skipText ? '' : ' ';
    const token = link.hyperlink + resolveRelativeURL(this.baseURL, this.url) + link.resetHyperlink;
    return new BaseElement(token, ctx.options.styles.link || {}, prefix).render(ctx);
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
    const { hyperlink, resetHyperlink } = makeHyperlink(this.url, ctx);
    let out = '';

    const style: StylePrimitive = { ...(ctx.options.styles.image_text || {}) };
    if (this.textOnly && style.format) style.format = style.format.replace(/ →$/, '');

    if (this.text.length > 0) {
      out += new BaseElement(hyperlink + this.text + resetHyperlink, style).render(ctx);
    }
    if (this.textOnly) return out;

    if (this.url.length > 0) {
      const token = hyperlink + resolveRelativeURL(this.baseURL, this.url) + resetHyperlink;
      out += new BaseElement(token, ctx.options.styles.image || {}, ' ').render(ctx);
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
    const styles = ctx.options.styles;
    const el = this.isOrdered
      ? new BaseElement('', styles.enumeration || {}, String(this.enumeration))
      : new BaseElement('', styles.item || {});
    return el.render(ctx);
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
    const { ticked, unticked, ...style } = ctx.options.styles.task || {};
    const prefix = (this.checked ? ticked : unticked) ?? '';
    return new BaseElement('', style, prefix).render(ctx);
  }
}

// ─── CodeBlockElement ──────────────────────────────────────────────────────────

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

/** Chroma formatters: the tty table size, or 0 for 24-bit colour. */
const FORMATTERS: Record<string, number> = {
  terminal: 8,
  terminal8: 8,
  terminal16: 16,
  terminal256: 256,
  terminal16m: 0,
};

/** chroma.ParseColour for the forms glamour styles use (#rgb, #rrggbb, ANSI index). */
function chromaColour(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const sgr = colorSGR(value, false, 3);
  let m = /^38;2;(\d+);(\d+);(\d+)$/.exec(sgr);
  if (m) return (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]);
  m = /^38;5;(\d+)$/.exec(sgr) ?? /^(?:3|9)(\d)$/.exec(sgr);
  if (!m) return undefined;
  const index = sgr.startsWith('9') ? Number(m[1]) + 8 : Number(m[1]);
  const [r, g, b] = xterm256RGB(index);
  return (r << 16) | (g << 8) | b;
}

function xterm256RGB(index: number): [number, number, number] {
  const ansi: [number, number, number][] = [
    [0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0], [0, 0, 128], [128, 0, 128], [0, 128, 128], [192, 192, 192],
    [128, 128, 128], [255, 0, 0], [0, 255, 0], [255, 255, 0], [0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
  ];
  if (index < 16) return ansi[index];
  if (index >= 232) {
    const v = 8 + (index - 232) * 10;
    return [v, v, v];
  }
  const levels = [0, 95, 135, 175, 215, 255];
  const cube = index - 16;
  return [levels[Math.floor(cube / 36)], levels[Math.floor(cube / 6) % 6], levels[cube % 6]];
}

/** chroma.Colour.Distance (the "redmean" approximation). */
function colourDistance(a: number, b: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const rmean = Math.trunc((ar + br) / 2);
  const r = ar - br;
  const g = ag - bg;
  const bl = ab - bb;
  return Math.sqrt((((512 + rmean) * r * r) >> 8) + 4 * g * g + (((767 - rmean) * bl * bl) >> 8));
}

/** findClosest: the nearest palette entry (first match wins on ties). */
function closest(table: [number, string][], colour: number): string {
  let best = table[0][1];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [candidate, escape] of table) {
    const distance = colourDistance(candidate, colour);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = escape;
    }
  }
  return best;
}

/** entryToEscapeSequence / the truecolour formatter's escape for one style entry. */
function chromaEscape(style: StylePrimitive, formatter: number): string {
  let out = '';
  if (style.bold) out += '\x1b[1m';
  if (style.underline) out += '\x1b[4m';
  if (style.italic) out += '\x1b[3m';
  const fg = chromaColour(style.color);
  const bg = chromaColour(style.background_color);
  if (formatter === 0) {
    if (fg !== undefined) out += `\x1b[38;2;${(fg >> 16) & 0xff};${(fg >> 8) & 0xff};${fg & 0xff}m`;
    if (bg !== undefined) out += `\x1b[48;2;${(bg >> 16) & 0xff};${(bg >> 8) & 0xff};${bg & 0xff}m`;
    return out;
  }
  const table = TTY_TABLES[formatter];
  if (fg !== undefined) out += closest(table.foreground, fg);
  if (bg !== undefined) out += closest(table.background, bg);
  return out;
}

/**
 * Syntax-highlight code with the style's chroma rules, writing tokens the way
 * chroma's terminal formatters do (escape + value + ESC[0m).
 *
 * Upstream lexes with chroma; this port lexes with highlight.js and maps its
 * token classes onto the same chroma style entries, so token boundaries (and
 * therefore the SGR sequences) can differ from upstream; the text does not.
 * Unknown or missing languages render as plain text, like chroma's fallback.
 */
function highlightCode(code: string, language: string, chroma: Chroma, ctx: RenderContext): string {
  const name = ctx.options.chromaFormatter || 'terminal256';
  let formatter = FORMATTERS[name];
  if (formatter === undefined) {
    throw new Error(`glamour: unknown chroma formatter ${name}`);
  }
  // Honor a lower color profile than the formatter produces.
  const profile = ctx.options.colorProfile;
  if (profile === 1 && (formatter === 0 || formatter === 256)) formatter = 16;
  else if (profile === 2 && formatter === 0) formatter = 256;

  // chroma's terminal formatters clear the Background entry's background color.
  const background: StylePrimitive = { ...(chroma.background ?? {}) };
  delete background.background_color;
  const base = cascadeStylePrimitives(background, chroma.text ?? {});
  const lexer = language.trim().split(/\s+/, 1)[0];
  let highlighted: string;
  try {
    highlighted = lexer && hljs.getLanguage(lexer)
      ? hljs.highlight(code, { language: lexer, ignoreIllegals: true }).value
      : escapeHTML(code);
  } catch {
    highlighted = escapeHTML(code);
  }

  const emit = (value: string, style: StylePrimitive): string => {
    if (profile <= 0) return value;
    const escape = chromaEscape(style, formatter);
    return escape ? escape + value + '\x1b[0m' : value;
  };

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
        (_entity, entity: string) => ({
          lt: '<',
          gt: '>',
          amp: '&',
          quot: '"',
          '#x27': "'",
        } as Record<string, string>)[entity],
      );
      output += emit(decoded, styles[styles.length - 1]);
    }
  }
  return output;
}

function escapeHTML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** CodeBlockElement renders fenced and indented code blocks. */
export class CodeBlockElement implements ElementRenderer {
  code: string;
  language: string;

  constructor(code: string, language: string = '') {
    this.code = code;
    this.language = language;
  }

  render(ctx: RenderContext): string {
    const rules: StyleCodeBlock = ctx.options.styles.code_block || {};
    const indentation = rules.indent ?? 0;
    const margin = rules.margin ?? 0;
    const current = currentPrimitive(ctx);

    const w = new StringWriter();
    const iw = new IndentWriter(w, indentation + margin, () => {
      w.write(renderStyled(ctx, ' ', current));
    });

    if (rules.chroma) {
      iw.write(renderStyled(ctx, rules.block_prefix ?? '', current));
      iw.write(highlightCode(this.code, this.language, rules.chroma, ctx));
      iw.write(renderStyled(ctx, rules.block_suffix ?? '', current));
    } else {
      // fallback rendering
      iw.write(new BaseElement(this.code, toStylePrimitive(rules)).render(ctx));
    }
    iw.close();
    return w.value;
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
    const content = (this.style.prefix ?? '') + this.text + (this.style.suffix ?? '');
    return renderStyled(ctx, content, this.style);
  }
}

// ─── StrikethroughElement ─────────────────────────────────────────────────────

/** StrikethroughElement renders the plain text of a strikethrough span. */
export class StrikethroughElement extends BaseElement {
  constructor(text: string = '', style: StylePrimitive = {}) {
    super(text, style);
  }

  override render(ctx: RenderContext): string {
    this.style = ctx.options.styles.strikethrough || this.style;
    return super.render(ctx);
  }
}

// ─── HRElement ─────────────────────────────────────────────────────────────────

/**
 * HRElement renders a thematic break: an empty token rendered once with the
 * hr style, whose format (e.g. "\n--------\n") draws the rule.
 */
export class HRElement extends BaseElement {
  override render(ctx: RenderContext): string {
    this.style = ctx.options.styles.hr || {};
    return super.render(ctx);
  }
}

// ─── Tables ────────────────────────────────────────────────────────────────────

/** TableCellElement renders a single cell in a row. */
export class TableCellElement implements ElementRenderer {
  constructor(
    public children: ElementRenderer[],
    public head: boolean = false,
  ) {}

  render(ctx: RenderContext): string {
    const style = toStylePrimitive(ctx.options.styles.table || {});
    let b = '';
    for (const child of this.children) {
      if (isStyleOverrider(child)) {
        b += child.styleOverrideRender(ctx, style);
      } else {
        b += new BaseElement(child.render(ctx), style).render(ctx);
      }
    }
    if (this.head) ctx.table.header.push(b);
    else ctx.table.row.push(b);
    return '';
  }
}

/** TableRowElement adds the collected cells as a table row. */
export class TableRowElement implements ElementFinisher {
  finish(ctx: RenderContext): string {
    if (!ctx.table.lipgloss) return '';
    ctx.table.lipgloss.row(...ctx.table.row);
    ctx.table.rows.push(ctx.table.row);
    ctx.table.row = [];
    return '';
  }
}

/** TableHeadElement sets the collected cells as the table headers. */
export class TableHeadElement implements ElementFinisher {
  finish(ctx: RenderContext): string {
    if (!ctx.table.lipgloss) return '';
    ctx.table.lipgloss.setHeaders(...ctx.table.header);
    ctx.table.header = [];
    return '';
  }
}

function tableLinkKey(link: TableLink): string {
  return `${link.type}\0${link.href}\0${link.title}\0${link.content}`;
}

/** linkWithSuffix: append the footer index of a table link to its text. */
function linkWithSuffix(link: TableLink, list: TableLink[]): string {
  const key = tableLinkKey(link);
  const index = list.findIndex((existing) => tableLinkKey(existing) === key);
  return index === -1 ? link.content : `${link.content}[${index + 1}]`;
}

/** TableElement renders a GFM table through the lipgloss table port. */
export class TableElement implements ElementRenderer, ElementFinisher {
  constructor(
    private readonly alignments: ('left' | 'center' | 'right' | 'none')[] = [],
    private readonly node?: Node,
  ) {}

  render(ctx: RenderContext): string {
    const bs = ctx.blockStack;
    const rules: StyleTable = ctx.options.styles.table || {};
    const current = currentPrimitive(ctx);
    const w = new StringWriter();
    const iw = new IndentWriter(w, (rules.indent ?? 0) + (rules.margin ?? 0), () => {
      w.write(renderStyled(ctx, ' ', current));
    });

    const style = bs.with(toStylePrimitive(rules));
    iw.write(renderStyled(ctx, rules.block_prefix ?? '', current));
    iw.write(renderStyled(ctx, rules.prefix ?? '', style));

    ctx.table = {
      header: [],
      row: [],
      rows: [],
      alignments: [...this.alignments],
      links: [],
      images: [],
      lipgloss: new Table(ctx.options.colorProfile)
        .width(bs.width(ctx.options.wordWrap))
        .wrap(ctx.options.tableWrap ?? true),
    };
    if (this.node) collectLinksAndImages(this.node, ctx);

    iw.close();
    return w.value;
  }

  private setStyles(ctx: RenderContext, table: Table): void {
    const docBackground = ctx.options.styles.document?.background_color;
    if (docBackground !== undefined) table.baseStyle(docBackground);
    const margin = ctx.options.styles.table?.margin;
    const alignments = ctx.table.alignments;

    table.setStyleFunc((_row, col) => {
      let st: CellStyle = { marginLeft: 1, marginRight: 1 };
      if (margin !== undefined) st = { ...st, paddingLeft: margin, paddingRight: margin };
      switch (alignments[col]) {
        case 'left': st = { ...st, align: 'left', paddingRight: 0 }; break;
        case 'center': st = { ...st, align: 'center' }; break;
        case 'right': st = { ...st, align: 'right', paddingLeft: 0 }; break;
        default: break;
      }
      return st;
    });
  }

  private setBorders(ctx: RenderContext, table: Table): void {
    const rules = ctx.options.styles.table || {};
    let border = normalBorder();
    if (rules.row_separator !== undefined && rules.column_separator !== undefined) {
      border = {
        ...border,
        top: rules.row_separator,
        bottom: rules.row_separator,
        left: rules.column_separator,
        right: rules.column_separator,
        middle: rules.center_separator ?? '',
        topLeft: '',
        topRight: '',
        bottomLeft: '',
        bottomRight: '',
        middleLeft: '',
        middleRight: '',
        middleTop: '',
        middleBottom: '',
      };
    }
    table.setBorder(border).setBorderTop(false).setBorderLeft(false).setBorderRight(false).setBorderBottom(false);
  }

  finish(ctx: RenderContext): string {
    const table = ctx.table.lipgloss;
    if (!table) return '';
    const rules = ctx.options.styles.table || {};
    const bs = ctx.blockStack;

    this.setStyles(ctx, table);
    this.setBorders(ctx, table);

    bs.writeToCurrentBlock(table.toString());
    bs.writeToCurrentBlock(renderStyled(ctx, rules.suffix ?? '', bs.with(toStylePrimitive(rules))));
    bs.writeToCurrentBlock(renderStyled(ctx, rules.block_suffix ?? '', currentPrimitive(ctx)));

    printTableLinks(ctx);

    ctx.table.lipgloss = null;
    ctx.table.links = [];
    ctx.table.images = [];
    return '';
  }
}

/** printTableLinks: the footer listing links and images referenced in a table. */
function printTableLinks(ctx: RenderContext): void {
  if (ctx.options.inlineTableLinks) return;
  if (ctx.table.links.length === 0 && ctx.table.images.length === 0) return;

  const bs = ctx.blockStack;
  const termWidth = bs.width(ctx.options.wordWrap);
  const w: Writer = { write: (s) => bs.writeToCurrentBlock(s) };
  const styles = ctx.options.styles;

  const renderLinkText = (link: TableLink, position: number, padding: number): string => {
    let token = ' '.repeat(padding);
    let style: StylePrimitive = styles.link_text || {};
    if (link.type === 'image') {
      token += link.content;
      const imageText = styles.image_text || {};
      style = { ...imageText, prefix: `[${position}]: ${imageText.prefix ?? ''}` };
    } else {
      token += `[${position}]: ${link.content}`;
    }
    const out = new BaseElement(token, style).render(ctx);
    w.write(out);
    return out;
  };

  const renderLinkHref = (link: TableLink, linkText: string): void => {
    const { hyperlink, resetHyperlink } = makeHyperlink(link.href, ctx);
    const style = link.type === 'image' ? styles.image || {} : styles.link || {};
    const linkMaxWidth = Math.max(termWidth - stringWidth(linkText) - 1, 0);
    const token = hyperlink + truncate(link.href, linkMaxWidth, '…') + resetHyperlink;
    w.write(new BaseElement(token, style).render(ctx));
  };

  const renderString = (s: string): void => {
    w.write(renderStyled(ctx, s, currentPrimitive(ctx)));
  };

  const renderList = (list: TableLink[]): void => {
    list.forEach((item, i) => {
      const position = i + 1;
      const padding = Math.max(String(list.length).length - String(position).length, 0);
      renderString('\n');
      const linkText = renderLinkText(item, position, padding);
      renderString(' ');
      renderLinkHref(item, linkText);
    });
  };

  if (ctx.table.links.length > 0) renderString('\n');
  renderList(ctx.table.links);
  if (ctx.table.images.length > 0) renderString('\n');
  renderList(ctx.table.images);
}

/** collectLinksAndImages: gather (deduplicated) table links for the footer. */
function collectLinksAndImages(table: Node, ctx: RenderContext): void {
  const links: TableLink[] = [];
  const images: TableLink[] = [];
  const add = (list: TableLink[], link: TableLink): void => {
    const key = tableLinkKey(link);
    if (!list.some((existing) => tableLinkKey(existing) === key)) list.push(link);
  };
  const walk = (node: Node): void => {
    switch (node.kind) {
      case 'auto_link': {
        const uri = node.destination || node.literal || '';
        const [shortened, ok] = detect(uri);
        add(links, { href: uri, title: '', content: ok ? shortened : linkDomain(uri), type: 'auto' });
        break;
      }
      case 'image': {
        const href = node.destination || '';
        add(images, {
          href,
          title: node.title || '',
          content: nodeContent(node) || linkDomain(href),
          type: 'image',
        });
        break;
      }
      case 'link':
        add(links, {
          href: node.destination || '',
          title: node.title || '',
          content: nodeContent(node),
          type: 'regular',
        });
        break;
    }
    for (const child of node.children) walk(child);
  };
  walk(table);
  ctx.table.links = links;
  ctx.table.images = images;
}

// ─── Node helpers ──────────────────────────────────────────────────────────────

/**
 * Checks if a node is rendered by an ancestor element (CodeSpan, Link,
 * AutoLink, Image, Emphasis, Strikethrough, TableCell) rather than the walker.
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

/** nodeContent: the concatenated text of a node's descendants. */
function nodeContent(node: Node): string {
  let text = '';
  for (const child of node.children) {
    if (child.kind === 'text') text += child.literal ?? '';
    else if (child.kind === 'code_span') text += child.literal ?? '';
    else if (child.kind !== 'auto_link') text += nodeContent(child);
  }
  return text;
}

/** ast.Node.Text: plain text of an inline node (code spans included). */
function nodeText(node: Node): string {
  if (node.kind === 'text' || node.kind === 'code_span') return node.literal ?? '';
  let text = '';
  for (const child of node.children) text += nodeText(child);
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

/** linkDomain: url.Parse(href).Hostname(), or "link" when unparsable. */
function linkDomain(href: string): string {
  if (/[\x00-\x1f\x7f]/.test(href)) return 'link';
  try {
    return new URL(href).hostname.replace(/^\[|\]$/g, '');
  } catch {
    return '';
  }
}

function childRenderers(node: Node, ctx: RenderContext): ElementRenderer[] {
  const children: ElementRenderer[] = [];
  for (const child of node.children) {
    const renderer = newElement(child, ctx).renderer;
    if (renderer) children.push(renderer);
  }
  return children;
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
    case 'document': {
      const be = new BlockElement(styles.document || {}, true);
      return { renderer: be, finisher: be };
    }

    case 'heading': {
      const he = new HeadingElement(node.level || 1, !node.prevSibling);
      return { exiting: '', renderer: he, finisher: he };
    }

    case 'paragraph': {
      if (node.parent?.kind === 'list_item') return {};
      return {
        renderer: new ParagraphElement(!node.prevSibling),
        finisher: new ParagraphElement(),
      };
    }

    case 'block_quote': {
      const be = new BlockElement(cascadeStyle(bs.current().style, styles.block_quote || {}, false), true);
      return { entering: '\n', renderer: be, finisher: be };
    }

    case 'list': {
      const s: StyleList = { ...(styles.list || {}) };
      if (s.indent === undefined) s.indent = 0;
      for (let n = node.parent; n; n = n.parent) {
        if (n.kind === 'list') {
          s.indent = styles.list?.level_indent ?? 0;
          break;
        }
      }
      const be = new BlockElement(cascadeStyle(bs.current().style, s, false), true, true);
      return { entering: '\n', renderer: be, finisher: be };
    }

    case 'list_item': {
      let l = 1;
      for (let n: Node = node; n.prevSibling && n.prevSibling.kind === 'list_item'; n = n.prevSibling) l++;
      const isOrdered = node.parent?.ordered || false;
      let e = 0;
      if (isOrdered) {
        e = l;
        const start = node.parent?.start ?? 1;
        if (start !== 1) e += start - 1;
      }

      let post = '\n';
      const lastChild = node.children[node.children.length - 1];
      if ((lastChild && lastChild.kind === 'list') || !node.nextSibling) post = '';

      const firstChild = node.children[0];
      const checkbox = firstChild?.kind === 'task_checkbox' ? firstChild : firstChild?.children[0];
      if (checkbox?.kind === 'task_checkbox') {
        return { exiting: post, renderer: new TaskElement(checkbox.checked || false) };
      }
      return { exiting: post, renderer: new ItemElement(isOrdered, e) };
    }

    case 'text': {
      let s = node.literal || '';
      if (node.hardBreak || node.softBreak) s += '\n';
      return { renderer: new BaseElement(s, styles.text || {}) };
    }

    case 'emphasis':
      return { renderer: new EmphasisElement(node.level || 1, childRenderers(node, ctx)) };

    case 'strikethrough':
      return { renderer: new StrikethroughElement(nodeText(node), styles.strikethrough || {}) };

    case 'thematic_break':
      return { entering: '', exiting: '', renderer: new HRElement('', styles.hr || {}) };

    case 'link': {
      const footerLinks = !ctx.options.inlineTableLinks && isInsideTable(node);
      let children: ElementRenderer[];
      if (footerLinks) {
        const text = linkWithSuffix({
          content: nodeContent(node),
          href: node.destination || '',
          title: node.title || '',
          type: 'regular',
        }, ctx.table.links);
        children = [new BaseElement(text)];
      } else {
        children = childRenderers(node, ctx);
      }
      return {
        renderer: new LinkElement(
          node.destination || '',
          children,
          ctx.options.baseURL ?? '',
          false,
          footerLinks,
        ),
      };
    }

    case 'auto_link': {
      let u = node.destination || node.literal || '';
      const email = /^mailto:/i.test(u) && !/^mailto:/i.test(node.literal ?? '');
      const label = email ? u.replace(/^mailto:/i, '') : u;
      const footerLinks = !ctx.options.inlineTableLinks && isInsideTable(node);
      if (email && !/^mailto:/i.test(u)) u = `mailto:${u}`;

      if (footerLinks) {
        const [shortened, ok] = detect(u);
        const text = linkWithSuffix({
          content: ok ? shortened : linkDomain(u),
          href: u,
          title: '',
          type: 'auto',
        }, ctx.table.links);
        return { renderer: new LinkElement(u, [new BaseElement(text)], '', false, true) };
      }
      return {
        renderer: new LinkElement(u, [new BaseElement(label)], '', !email, email),
      };
    }

    case 'image': {
      let text = nodeText(node);
      const href = node.destination || '';
      const footerImage = !ctx.options.inlineTableLinks && isInsideTable(node);
      if (footerImage) {
        if (text === '') text = linkDomain(href);
        text = linkWithSuffix({
          title: node.title || '',
          content: text,
          href,
          type: 'image' as TableLinkType,
        }, ctx.table.images);
      }
      return {
        renderer: new ImageElement(text, href, ctx.options.baseURL ?? '', footerImage),
      };
    }

    case 'code_block':
    case 'fenced_code_block':
      return {
        entering: '\n',
        renderer: new CodeBlockElement(node.literal || '', node.info || ''),
      };

    case 'code_span': {
      const codeStyle = cascadeStyle(bs.current().style, styles.code || {}, false);
      const text = decodeEntities(node.literal || ''); // html.UnescapeString
      return { renderer: new CodeSpanElement(text, toStylePrimitive(codeStyle)) };
    }

    case 'table': {
      const te = new TableElement(node.alignments || [], node);
      return { entering: '\n', exiting: '\n', renderer: te, finisher: te };
    }

    case 'table_header':
      return { finisher: new TableHeadElement() };

    case 'table_row':
      return node.parent?.kind === 'table_header' ? {} : { finisher: new TableRowElement() };

    case 'table_cell': {
      let parent = node.parent;
      while (parent && parent.kind !== 'table_header' && parent.kind !== 'table') parent = parent.parent;
      return {
        renderer: new TableCellElement(childRenderers(node, ctx), parent?.kind === 'table_header'),
      };
    }

    case 'definition_list': {
      const block = new BlockElement(
        cascadeStyle(bs.current().style, styles.definition_list || {}, false),
        true,
        true,
      );
      return { renderer: block, finisher: block };
    }

    case 'definition_term':
      return { entering: '\n', renderer: new BaseElement('', styles.definition_term || {}) };

    case 'definition_description':
      return { exiting: '\n', renderer: new BaseElement('', styles.definition_description || {}) };

    case 'emoji':
      return { renderer: new BaseElement(node.literal || '') };

    case 'html_block':
      return {
        renderer: new BaseElement(
          ctx.sanitizeHTML(node.literal || '', true),
          toStylePrimitive(styles.html_block || {}),
        ),
      };

    case 'html_inline':
      return {
        renderer: new BaseElement(
          ctx.sanitizeHTML(node.literal || '', true),
          toStylePrimitive(styles.html_span || {}),
        ),
      };

    case 'task_checkbox':
    case 'text_block':
      return {};

    default:
      return {};
  }
}
