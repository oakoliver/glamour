// writers.ts — MarginWriter, PaddingWriter, IndentWriter
// Port of charmbracelet/glamour/ansi/margin.go

import { stringWidth } from './baseelement.js';

/** Minimal writer contract used to compose renderer writer chains. */
export interface WriterSink {
  write(value: string): unknown;
  flush?(): unknown;
  close?(): unknown;
}

// ─── PaddingWriter ──────────────────────────────────────────────────────────

/**
 * PaddingWriter pads each line with spaces (optionally styled) to fill a fixed width.
 * Used for code blocks and other elements that need a solid background.
 *
 * After content is written, each line is padded with spaces to fill the
 * specified width. The padding spaces can be wrapped in an ANSI style string
 * (e.g. background color).
 */
export class PaddingWriter {
  private buffer: string;
  private width: number;
  private padStyle: string; // ANSI open sequence for padding spaces (e.g. "\x1b[48;5;236m")
  private sink?: WriterSink;
  private closed = false;

  constructor(width: number, padStyle?: string);
  constructor(sink: WriterSink, width: number, padStyle?: string);
  constructor(
    widthOrSink: number | WriterSink,
    widthOrStyle?: number | string,
    padStyle?: string,
  ) {
    this.buffer = '';
    if (typeof widthOrSink === 'number') {
      this.width = widthOrSink;
      this.padStyle = typeof widthOrStyle === 'string' ? widthOrStyle : '';
    } else {
      this.sink = widthOrSink;
      this.width = typeof widthOrStyle === 'number' ? widthOrStyle : 0;
      this.padStyle = padStyle ?? '';
    }
  }

  /** Append content to the internal buffer. */
  write(s: string): void {
    this.buffer += s;
  }

  /**
   * Flush the buffer, applying padding to each line.
   * Each line shorter than `width` gets spaces appended to fill.
   * Returns the padded content.
   */
  flush(): string {
    if (this.width <= 0) return this.buffer;

    const lines = this.buffer.split('\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const visibleWidth = stringWidth(line);

      if (visibleWidth < this.width) {
        const padCount = this.width - visibleWidth;
        const padSpaces = ' '.repeat(padCount);

        if (this.padStyle) {
          result.push(line + this.padStyle + padSpaces + '\x1b[0m');
        } else {
          result.push(line + padSpaces);
        }
      } else {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  /** Flush this writer before closing its downstream writer. */
  close(): string {
    if (this.closed) return this.flush();
    const output = this.flush();
    this.sink?.write(output);
    this.sink?.flush?.();
    this.sink?.close?.();
    this.closed = true;
    return output;
  }
}

// ─── IndentWriter ───────────────────────────────────────────────────────────

/**
 * IndentWriter prepends an indentation token to each line.
 * Used for block quotes (with "│ " prefix) and list items.
 *
 * The indent token can be any string (e.g. "│ ", "  ", "> ").
 * The indent is prepended `count` times to each line.
 */
export class IndentWriter {
  private buffer: string;
  private indent: string;
  private count: number;
  private sink?: WriterSink;
  private closed = false;

  /**
   * @param indent The indent token to prepend (e.g. "│ ", "  ")
   * @param count  Number of times to repeat the indent token per line (default 1)
   */
  constructor(indent: string, count?: number);
  constructor(sink: WriterSink, indent: string, count?: number);
  constructor(
    indentOrSink: string | WriterSink,
    indentOrCount: string | number = 1,
    count: number = 1,
  ) {
    this.buffer = '';
    if (typeof indentOrSink === 'string') {
      this.indent = indentOrSink;
      this.count = typeof indentOrCount === 'number' ? indentOrCount : 1;
    } else {
      this.sink = indentOrSink;
      this.indent = typeof indentOrCount === 'string' ? indentOrCount : '';
      this.count = count;
    }
  }

  /** Append content to the internal buffer. */
  write(s: string): void {
    this.buffer += s;
  }

  /**
   * Flush the buffer, prepending the indent token to each line.
   * Returns the indented content.
   */
  flush(): string {
    const lines = this.buffer.split('\n');
    const prefix = this.indent.repeat(this.count);
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      result.push(prefix + lines[i]);
    }

    return result.join('\n');
  }

  /**
   * Close this writer before its downstream sink. This ordering is required so
   * trailing ANSI resets produced during flush never write into a closed sink.
   */
  close(): string {
    if (this.closed) return this.flush();
    const output = this.flush();
    this.sink?.write(output);
    this.sink?.flush?.();
    this.sink?.close?.();
    this.closed = true;
    return output;
  }
}

// ─── MarginWriter ───────────────────────────────────────────────────────────

/**
 * MarginWriter adds a left margin (spaces) to each line of output.
 *
 * In the Go implementation this wraps an io.Writer and prepends margin spaces.
 * In our TS version we accumulate content then apply the margin on flush().
 */
export class MarginWriter {
  private buffer: string;
  private margin: number; // number of spaces for left margin
  private sink?: WriterSink;
  private closed = false;

  constructor(margin: number);
  constructor(sink: WriterSink, margin: number);
  constructor(marginOrSink: number | WriterSink, margin: number = 0) {
    this.buffer = '';
    if (typeof marginOrSink === 'number') {
      this.margin = marginOrSink;
    } else {
      this.sink = marginOrSink;
      this.margin = margin;
    }
  }
  /** Append content to the internal buffer. */
  write(s: string): void {
    this.buffer += s;
  }

  /**
   * Flush the buffer, prepending margin spaces to each line.
   * Returns the content with margins applied.
   */
  flush(): string {
    if (this.margin <= 0) return this.buffer;

    const marginStr = ' '.repeat(this.margin);
    const lines = this.buffer.split('\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      result.push(marginStr + lines[i]);
    }

    return result.join('\n');
  }

  close(): string {
    if (this.closed) return this.flush();
    const output = this.flush();
    this.sink?.write(output);
    this.sink?.flush?.();
    this.sink?.close?.();
    this.closed = true;
    return output;
  }
}

export function newPaddingWriter(
  sink: WriterSink,
  width: number,
  padStyle?: string,
): PaddingWriter {
  return new PaddingWriter(sink, width, padStyle);
}

export function newIndentWriter(
  sink: WriterSink,
  indent: string,
  count: number = 1,
): IndentWriter {
  return new IndentWriter(sink, indent, count);
}

export function newMarginWriter(sink: WriterSink, margin: number): MarginWriter {
  return new MarginWriter(sink, margin);
}
