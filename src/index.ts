// index.ts — Barrel exports for @oakoliver/glamour
// Re-exports the entire public API surface from all modules.

// ─── Core types (style.ts) ──────────────────────────────────────────────────

export type {
  StyleConfig,
  StylePrimitive,
  StyleBlock,
  StyleCodeBlock,
  StyleList,
  StyleTable,
  StyleTask,
  Chroma,
} from './style.js';

export {
  cascadeStyle,
  cascadeStylePrimitive,
  cascadeStylePrimitives,
  cascadeStyles,
  toStylePrimitive,
} from './style.js';

// ─── Parser (parser.ts) ─────────────────────────────────────────────────────

export { NodeKind, parse } from './parser.js';
export type { Node } from './parser.js';

// ─── Base rendering (baseelement.ts) ────────────────────────────────────────

export {
  renderText,
  buildSGR,
  parseColorToSGR,
  wordWrap,
  stringWidth,
  stripAnsi,
  stripHTML,
} from './baseelement.js';

// ─── Writers (writers.ts) ───────────────────────────────────────────────────

export { MarginWriter, PaddingWriter, IndentWriter } from './writers.js';

// ─── Themes (themes.ts) ─────────────────────────────────────────────────────

export {
  DarkStyle,
  LightStyle,
  ASCIIStyle,
  DraculaStyle,
  TokyoNightStyle,
  PinkStyle,
  NoTTYStyle,
  DarkStyleName,
  LightStyleName,
  ASCIIStyleName,
  DraculaStyleName,
  TokyoNightStyleName,
  PinkStyleName,
  NoTTYStyleName,
  AutoStyleName,
  defaultStyles,
  getDefaultStyle,
} from './themes.js';

// ─── Context (context.ts) ───────────────────────────────────────────────────

export { RenderContext } from './context.js';
export type { RenderOptions } from './context.js';

// ─── Renderer (renderer.ts) ─────────────────────────────────────────────────

export { renderNodes } from './renderer.js';

// ─── Public API — glamour.ts (main entry points) ───────────────────────────

export {
  TermRenderer,
  render,
  renderWithStyle,
  renderBytes,
  renderWithEnvironmentConfig,
  withStyles,
  withStandardStyle,
  withStylesFromJSON,
  withStylePath,
  withWordWrap,
  withColorProfile,
  withHyperlinks,
  withPreservedNewLines,
  withBaseURL,
  withEnvironmentConfig,
  withAutoStyle,
  withOptions,
} from './glamour.js';

export type { TermRendererOption } from './glamour.js';
