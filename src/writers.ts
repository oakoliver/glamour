// writers.ts — MarginWriter, PaddingWriter, IndentWriter
// Port of charmbracelet/glamour/ansi/margin.go

import { stringWidth } from './baseelement.js';

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

  constructor(width: number, padStyle?: string) {
    this.buffer = '';
    this.width = width;
    this.padStyle = padStyle ?? '';
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

  /**
   * @param indent The indent token to prepend (e.g. "│ ", "  ")
   * @param count  Number of times to repeat the indent token per line (default 1)
   */
  constructor(indent: string, count: number = 1) {
    this.buffer = '';
    this.indent = indent;
    this.count = count;
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

  constructor(margin: number) {
    this.buffer = '';
    this.margin = margin;
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
}
