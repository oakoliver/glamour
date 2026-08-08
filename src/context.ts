// RenderContext — holds the current rendering options and state.
// Port of charmbracelet/glamour/ansi/context.go + renderer.go Options

import { randomUUID } from 'node:crypto';
import type { StyleConfig } from './style.js';
import { BlockStack } from './blockstack.js';

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
}

/** RenderContext holds shared state during rendering. */
export class RenderContext {
  options: RenderOptions;
  blockStack: BlockStack;
  table: TableContext;
  readonly protectedSegments = new Set<string>();
  private readonly protectionNamespace = randomUUID();
  private protectionCounter = 0;

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
    };
  }

  /** Mark one exact rendered occurrence as atomic across nested wrapping passes. */
  protectSegment(value: string): string {
    const id = this.protectionCounter++;
    const start = `\0glamour:${this.protectionNamespace}:${id}:start\0`;
    const end = `\0glamour:${this.protectionNamespace}:${id}:end\0`;
    this.protectedSegments.add(start);
    this.protectedSegments.add(end);
    return start + value + end;
  }

  /** Remove occurrence metadata before returning root output. */
  unprotectSegments(value: string): string {
    let output = value;
    for (const marker of this.protectedSegments) output = output.replaceAll(marker, '');
    return output;
  }

  /** Strip HTML tags from a string. */
  sanitizeHTML(s: string, trimSpaces: boolean): string {
    // Simple HTML tag stripping (no external dependency)
    let result = s.replace(/<[^>]*>/g, '');
    // Decode each source entity exactly once.
    result = result.replace(
      /&(amp|lt|gt|quot|#39|#x27|nbsp);/g,
      (_entity, name: string) => ({
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        '#39': "'",
        '#x27': "'",
        nbsp: ' ',
      } as Record<string, string>)[name],
    );
    if (trimSpaces) {
      result = result.trim();
    }
    return result;
  }
}

export function newRenderContext(options: RenderOptions): RenderContext {
  return new RenderContext(options);
}
