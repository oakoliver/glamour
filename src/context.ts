// RenderContext — holds the current rendering options and state.
// Port of charmbracelet/glamour/ansi/context.go + renderer.go Options

import type { StyleConfig } from './style.js';
import { BlockStack } from './blockstack.js';
import type { Table } from './table.js';
import { decodeEntities } from './parser.js';

/** Options for configuring the ANSI renderer. */
export interface RenderOptions {
  styles: StyleConfig;
  wordWrap: number;       // max line width (0 = no wrap)
  colorProfile: number;   // 0=no ANSI, 1=ANSI, 2=256, 3=TrueColor
  hyperlinks: boolean;    // enable OSC 8 hyperlinks
  preserveNewLines: boolean;
  baseURL?: string;
  tableWrap?: boolean;
  inlineTableLinks?: boolean;
  chromaFormatter?: string;
}

/** Upstream-compatible name for ANSI renderer options. */
export type Options = RenderOptions;

export type TableLinkType = 'auto' | 'image' | 'regular';

export interface TableLink {
  href: string;
  title: string;
  content: string;
  type: TableLinkType;
}

/** Table rendering state — accumulated rows/cells during table walking. */
export interface TableContext {
  header: string[];
  row: string[];
  rows: string[][];
  alignments: ('left' | 'center' | 'right' | 'none')[];
  links: TableLink[];
  images: TableLink[];
  /** The table being built (upstream's ctx.table.lipgloss); null outside tables. */
  lipgloss: Table | null;
}

/** RenderContext holds shared state during rendering. */
export class RenderContext {
  options: RenderOptions;
  blockStack: BlockStack;
  table: TableContext;

  constructor(options: RenderOptions) {
    this.options = {
      ...options,
      baseURL: options.baseURL ?? '',
      tableWrap: options.tableWrap ?? true,
      inlineTableLinks: options.inlineTableLinks ?? false,
      chromaFormatter: options.chromaFormatter ?? 'terminal256',
    };
    this.blockStack = new BlockStack();
    this.table = {
      header: [],
      row: [],
      rows: [],
      alignments: [],
      links: [],
      images: [],
      lipgloss: null,
    };
  }

  /** Strip HTML tags from a string. */
  sanitizeHTML(s: string, trimSpaces: boolean): string {
    // bluemonday's StrictPolicy: drop the content of elements it skips
    // entirely, then strip every remaining tag.
    let result = s.replace(
      /<(frameset|iframe|noembed|noframes|noscript|nostyle|object|script|style|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      '',
    );
    result = result.replace(/<[^>]*>/g, '');
    // html.UnescapeString: decode each source entity exactly once.
    result = decodeEntities(result);
    if (trimSpaces) {
      result = result.trim();
    }
    return result;
  }
}

export function newRenderContext(options: RenderOptions): RenderContext {
  return new RenderContext(options);
}
