// writers.ts — MarginWriter, PaddingWriter, IndentWriter
// Port of charmbracelet/glamour/ansi/margin.go
//
// All writers stream: every write is forwarded immediately, exactly like the
// io.Writer chain upstream. Indentation and padding callbacks receive the
// writer they would write to, but (as upstream) callers may write elsewhere.

import {
  RESET_STYLE,
  WrapWriter,
  resetHyperlink,
  setHyperlink,
  stringWidth,
  type Writer,
} from './ansi.js';
import type { RenderContext } from './context.js';
import type { StyleBlock } from './style.js';
import { toStylePrimitive } from './style.js';
import { renderText } from './baseelement.js';

/** Minimal writer contract used to compose renderer writer chains. */
export interface WriterSink extends Writer {
  close?(): unknown;
}

/** PaddingFunc writes one unit of padding. */
export type PaddingFunc = (w: Writer) => void;

/** IndentFunc writes one unit of indentation. */
export type IndentFunc = (w: Writer) => void;

// ─── PaddingWriter ──────────────────────────────────────────────────────────

/**
 * PaddingWriter pads every line to a fixed width when it sees the line's
 * newline. Text after the last newline is not padded.
 */
export class PaddingWriter implements WriterSink {
  padding: number;
  padFunc?: PaddingFunc;
  private readonly w: WrapWriter;
  private cache = '';

  constructor(w: Writer, padding: number, padFunc?: PaddingFunc) {
    this.padding = padding;
    this.padFunc = padFunc;
    this.w = new WrapWriter(w);
  }

  write(p: string): void {
    let start = 0;
    for (let nl = p.indexOf('\n'); nl !== -1; nl = p.indexOf('\n', start)) {
      const piece = p.slice(start, nl);
      this.cache += piece;
      this.w.write(piece);
      const lineWidth = stringWidth(this.cache);
      if (this.padding > 0 && lineWidth < this.padding) {
        if (this.padFunc) {
          for (let n = 0; n < this.padding - lineWidth; n++) this.padFunc(this.w);
        } else {
          this.w.write(' '.repeat(this.padding - lineWidth));
        }
      }
      this.cache = '';
      this.w.write('\n');
      start = nl + 1;
    }
    const rest = p.slice(start);
    this.cache += rest;
    this.w.write(rest);
  }

  close(): void {
    this.w.close();
  }
}

// ─── IndentWriter ───────────────────────────────────────────────────────────

/**
 * IndentWriter writes indentation at the start of every line. Any open style
 * or hyperlink is closed before the indentation and reopened after it.
 */
export class IndentWriter implements WriterSink {
  indent: number;
  indentFunc?: IndentFunc;
  private readonly w: WriterSink;
  private readonly pw: WrapWriter;
  private skipIndent = false;

  constructor(w: WriterSink, indent: number, indentFunc?: IndentFunc) {
    this.indent = indent;
    this.indentFunc = indentFunc;
    this.w = w;
    this.pw = new WrapWriter(w);
  }

  private resetPen(): void {
    const style = this.pw.style();
    const link = this.pw.link();
    if (!style.isZero()) this.w.write(RESET_STYLE);
    if (link.url !== '' || link.params !== '') this.w.write(resetHyperlink());
  }

  private restorePen(): void {
    const style = this.pw.style();
    const link = this.pw.link();
    if (!style.isZero()) this.w.write(style.toString());
    if (link.url !== '' || link.params !== '') this.w.write(setHyperlink(link.url, link.params));
  }

  write(p: string): void {
    let start = 0;
    while (start < p.length) {
      if (!this.skipIndent) {
        this.resetPen();
        if (this.indentFunc) {
          for (let j = 0; j < this.indent; j++) this.indentFunc(this.pw);
        } else {
          this.pw.write(' '.repeat(this.indent));
        }
        this.skipIndent = true;
        this.restorePen();
      }
      const nl = p.indexOf('\n', start);
      const end = nl === -1 ? p.length : nl + 1;
      if (nl !== -1) this.skipIndent = false;
      this.pw.write(p.slice(start, end));
      start = end;
    }
  }

  /** Close the wrap writer before the downstream writer, as upstream does. */
  close(): void {
    this.pw.close();
    this.w.close?.();
  }
}

// ─── MarginWriter ───────────────────────────────────────────────────────────

/**
 * MarginWriter applies a block's indentation (indent + margin, drawn with its
 * indent_token in the parent's style) and pads each line to the available
 * width with spaces in the block's own style.
 */
export class MarginWriter implements WriterSink {
  private readonly w: WrapWriter;
  private readonly iw: IndentWriter;

  constructor(ctx: RenderContext, w: Writer, rules: StyleBlock) {
    const bs = ctx.blockStack;
    const profile = ctx.options.colorProfile;
    const indentation = rules.indent ?? 0;
    const margin = rules.margin ?? 0;

    const pw = new PaddingWriter(w, bs.width(ctx.options.wordWrap), () => {
      w.write(renderText(' ', toStylePrimitive(rules), profile));
    });

    const ic = rules.indent_token ?? ' ';
    const parentStyle = toStylePrimitive(bs.parent().style);
    this.iw = new IndentWriter(pw, indentation + margin, () => {
      w.write(renderText(ic, parentStyle, profile));
    });
    this.w = new WrapWriter(w);
  }

  write(s: string): void {
    this.iw.write(s);
  }

  close(): void {
    this.w.close();
    this.iw.close();
  }
}

export function newPaddingWriter(w: Writer, padding: number, padFunc?: PaddingFunc): PaddingWriter {
  return new PaddingWriter(w, padding, padFunc);
}

export function newIndentWriter(w: WriterSink, indent: number, indentFunc?: IndentFunc): IndentWriter {
  return new IndentWriter(w, indent, indentFunc);
}

export function newMarginWriter(ctx: RenderContext, w: Writer, rules: StyleBlock): MarginWriter {
  return new MarginWriter(ctx, w, rules);
}
