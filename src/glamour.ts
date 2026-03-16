// glamour.ts — Public API for @oakoliver/glamour
// Port of charmbracelet/glamour/glamour.go
//
// Provides TermRenderer (with functional options) and convenience functions
// for rendering markdown to styled terminal output.

import type { StyleConfig } from './style.js';
import { parse } from './parser.js';
import { RenderContext } from './context.js';
import { renderNodes } from './renderer.js';
import { getDefaultStyle, DarkStyle, AutoStyleName } from './themes.js';

/** Default word wrap width, matching Go's defaultWidth = 80. */
const DEFAULT_WIDTH = 80;

/**
 * A TermRendererOption configures a TermRenderer.
 *
 * In Go this is `type TermRendererOption func(*TermRenderer) error`.
 * We keep the same functional-option pattern but return void and throw on error
 * (idiomatic TypeScript).
 */
export type TermRendererOption = (r: TermRenderer) => void;

/**
 * TermRenderer renders markdown content to ANSI-styled terminal output.
 *
 * Create with `new TermRenderer(...options)` or use the convenience functions
 * `render()`, `renderWithStyle()`, and `renderWithEnvironmentConfig()`.
 *
 * @example
 * ```ts
 * const r = new TermRenderer(withStandardStyle('dark'), withWordWrap(80));
 * console.log(r.render('# Hello\n\nWorld'));
 * ```
 */
export class TermRenderer {
  /** @internal */ _styles: StyleConfig;
  /** @internal */ _wordWrapWidth: number;
  /** @internal */ _colorProfile: number; // 0=none, 1=ANSI(16), 2=256, 3=TrueColor
  /** @internal */ _hyperlinks: boolean;
  /** @internal */ _preserveNewLines: boolean;
  /** @internal */ _baseURL: string;

  constructor(...options: TermRendererOption[]) {
    // Defaults — match Go's NewTermRenderer defaults
    this._styles = DarkStyle;
    this._wordWrapWidth = DEFAULT_WIDTH;
    this._colorProfile = 3; // TrueColor by default
    this._hyperlinks = true;
    this._preserveNewLines = false;
    this._baseURL = '';

    // Apply functional options
    for (const opt of options) {
      opt(this);
    }
  }

  /**
   * Render a markdown string to ANSI-styled terminal output.
   *
   * This is the main entry point — equivalent to Go's `(*TermRenderer).Render`.
   */
  render(markdown: string): string {
    // 1. Parse markdown to AST
    const ast = parse(markdown);

    // 2. Create render context with current configuration
    const ctx = new RenderContext({
      styles: this._styles,
      wordWrap: this._wordWrapWidth,
      colorProfile: this._colorProfile,
      hyperlinks: this._hyperlinks,
      preserveNewLines: this._preserveNewLines,
    });

    // 3. Render AST to styled output
    return renderNodes(ast, ctx);
  }

  /**
   * Render a markdown string and return the result as a Buffer.
   *
   * Equivalent to Go's `(*TermRenderer).RenderBytes`.
   */
  renderBytes(markdown: string): Buffer {
    return Buffer.from(this.render(markdown));
  }
}

// ─── Functional Options ─────────────────────────────────────────────────────
// Each option returns a TermRendererOption that mutates a TermRenderer.
// Matches the Go WithXxx pattern from glamour.go.

/**
 * Set styles from a StyleConfig object.
 * Equivalent to Go's `WithStyles(styles ansi.StyleConfig)`.
 */
export function withStyles(styles: StyleConfig): TermRendererOption {
  return (r: TermRenderer): void => {
    r._styles = styles;
  };
}

/**
 * Set styles from a built-in style name.
 *
 * Valid names: 'dark', 'light', 'ascii', 'dracula', 'tokyo-night', 'pink', 'notty', 'auto'.
 * Equivalent to Go's `WithStandardStyle(style string)`.
 */
export function withStandardStyle(name: string): TermRendererOption {
  return (r: TermRenderer): void => {
    r._styles = getDefaultStyle(name);
  };
}

/**
 * Set styles from a JSON string.
 * Equivalent to Go's `WithStylesFromJSONBytes(jsonBytes []byte)`.
 */
export function withStylesFromJSON(json: string): TermRendererOption {
  return (r: TermRenderer): void => {
    r._styles = JSON.parse(json) as StyleConfig;
  };
}

/**
 * Set styles from a style name or path.
 *
 * First tries to resolve as a built-in style name. If not found, attempts to
 * read and parse the path as a JSON file (Node.js/Bun only).
 *
 * Equivalent to Go's `WithStylePath(stylePath string)`.
 */
export function withStylePath(stylePath: string): TermRendererOption {
  return (r: TermRenderer): void => {
    // Try built-in style first
    try {
      r._styles = getDefaultStyle(stylePath);
      return;
    } catch {
      // Not a built-in style — fall through to file read
    }

    // Attempt to read from file (synchronous for option application)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    const jsonBytes = fs.readFileSync(stylePath, 'utf-8');
    r._styles = JSON.parse(jsonBytes) as StyleConfig;
  };
}

/**
 * Set word wrap width. Pass 0 to disable wrapping.
 * Equivalent to Go's `WithWordWrap(wordWrap int)`.
 */
export function withWordWrap(width: number): TermRendererOption {
  return (r: TermRenderer): void => {
    r._wordWrapWidth = width;
  };
}

/**
 * Set color profile:
 *   0 = no color
 *   1 = ANSI (16 colors)
 *   2 = 256 colors
 *   3 = TrueColor (24-bit)
 */
export function withColorProfile(profile: number): TermRendererOption {
  return (r: TermRenderer): void => {
    r._colorProfile = profile;
  };
}

/**
 * Enable or disable OSC 8 hyperlinks in rendered output.
 */
export function withHyperlinks(enabled: boolean): TermRendererOption {
  return (r: TermRenderer): void => {
    r._hyperlinks = enabled;
  };
}

/**
 * Preserve newlines from being replaced.
 * Equivalent to Go's `WithPreservedNewLines()`.
 */
export function withPreservedNewLines(): TermRendererOption {
  return (r: TermRenderer): void => {
    r._preserveNewLines = true;
  };
}

/**
 * Set a base URL for resolving relative links.
 * Equivalent to Go's `WithBaseURL(baseURL string)`.
 */
export function withBaseURL(baseURL: string): TermRendererOption {
  return (r: TermRenderer): void => {
    r._baseURL = baseURL;
  };
}

/**
 * Use environment-based configuration.
 *
 * Reads the `GLAMOUR_STYLE` environment variable to pick a style.
 * Falls back to 'dark' if not set.
 *
 * Equivalent to Go's `WithEnvironmentConfig()`.
 */
export function withEnvironmentConfig(): TermRendererOption {
  const styleName = getEnvironmentStyle();
  return withStylePath(styleName);
}

/**
 * Auto-detect style based on environment (terminal background, etc.).
 * Uses the 'auto' style which picks dark/light based on terminal.
 */
export function withAutoStyle(): TermRendererOption {
  return (r: TermRenderer): void => {
    r._styles = getDefaultStyle(AutoStyleName);
  };
}

/**
 * Compose multiple options into a single option.
 * Equivalent to Go's `WithOptions(options ...TermRendererOption)`.
 */
export function withOptions(...options: TermRendererOption[]): TermRendererOption {
  return (r: TermRenderer): void => {
    for (const opt of options) {
      opt(r);
    }
  };
}

// ─── Convenience Functions ──────────────────────────────────────────────────

/**
 * Quick render with a specific style name.
 *
 * Equivalent to Go's `glamour.Render(in, stylePath)`.
 *
 * @param markdown  The markdown content to render.
 * @param styleName Built-in style name (e.g. 'dark', 'light', 'ascii').
 *                  Defaults to 'dark'.
 * @returns Rendered ANSI string.
 */
export function render(markdown: string, styleName?: string): string {
  const options: TermRendererOption[] = [];
  if (styleName !== undefined) {
    options.push(withStylePath(styleName));
  }
  const r = new TermRenderer(...options);
  return r.render(markdown);
}

/**
 * Render with a specific style name.
 *
 * Convenience wrapper — equivalent to `render(markdown, styleName)`.
 */
export function renderWithStyle(markdown: string, styleName: string): string {
  const r = new TermRenderer(withStandardStyle(styleName));
  return r.render(markdown);
}

/**
 * Render a markdown string and return the result as a Buffer.
 *
 * Equivalent to Go's `glamour.RenderBytes(in, stylePath)`.
 */
export function renderBytes(markdown: string, styleName?: string): Buffer {
  const options: TermRendererOption[] = [];
  if (styleName !== undefined) {
    options.push(withStylePath(styleName));
  }
  const r = new TermRenderer(...options);
  return r.renderBytes(markdown);
}

/**
 * Render using environment-detected settings.
 *
 * Reads the `GLAMOUR_STYLE` environment variable. Falls back to 'dark'.
 *
 * Equivalent to Go's `glamour.RenderWithEnvironmentConfig(in)`.
 */
export function renderWithEnvironmentConfig(markdown: string): string {
  const styleName = getEnvironmentStyle();
  const r = new TermRenderer(withStylePath(styleName));
  return r.render(markdown);
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Read the GLAMOUR_STYLE env var, falling back to 'dark'.
 * Matches Go's getEnvironmentStyle().
 */
function getEnvironmentStyle(): string {
  if (typeof process !== 'undefined' && process.env?.GLAMOUR_STYLE) {
    return process.env.GLAMOUR_STYLE;
  }
  return 'dark';
}
