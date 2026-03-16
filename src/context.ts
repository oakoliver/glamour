// RenderContext — holds the current rendering options and state.
// Port of charmbracelet/glamour/ansi/context.go + renderer.go Options

import type { StyleConfig, StyleBlock, StylePrimitive } from './style.js';
import { BlockStack } from './blockstack.js';

/** Options for configuring the ANSI renderer. */
export interface RenderOptions {
  styles: StyleConfig;
  wordWrap: number;       // max line width (0 = no wrap)
  colorProfile: number;   // 0=no color, 1=ANSI, 2=256, 3=TrueColor
  hyperlinks: boolean;    // enable OSC 8 hyperlinks
  preserveNewLines: boolean;
}

/** Table rendering state — accumulated rows/cells during table walking. */
export interface TableContext {
  header: string[];
  row: string[];
  rows: string[][];
  alignments: ('left' | 'center' | 'right' | 'none')[];
}

/** RenderContext holds shared state during rendering. */
export class RenderContext {
  options: RenderOptions;
  blockStack: BlockStack;
  table: TableContext;

  constructor(options: RenderOptions) {
    this.options = options;
    this.blockStack = new BlockStack();
    this.table = {
      header: [],
      row: [],
      rows: [],
      alignments: [],
    };
  }

  /** Strip HTML tags from a string. */
  sanitizeHTML(s: string, trimSpaces: boolean): string {
    // Simple HTML tag stripping (no external dependency)
    let result = s.replace(/<[^>]*>/g, '');
    // Unescape common HTML entities
    result = result
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, ' ');
    if (trimSpaces) {
      result = result.trim();
    }
    return result;
  }
}
