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
export type { Node, NodeKindType, ParseOptions } from './parser.js';

// ─── Base rendering (baseelement.ts) ────────────────────────────────────────

export {
  renderText,
  buildSGR,
  parseColorToSGR,
  wordWrap,
  stringWidth,
  stripAnsi,
  stripHTML,
  escapeReplacer,
  formatTemplate,
  renderElement,
} from './baseelement.js';

// ─── Writers (writers.ts) ───────────────────────────────────────────────────

export {
  MarginWriter,
  PaddingWriter,
  IndentWriter,
  newMarginWriter,
  newPaddingWriter,
  newIndentWriter,
} from './writers.js';
export type { WriterSink } from './writers.js';

export { BlockElement } from './blockelement.js';
export { BlockStack } from './blockstack.js';
export type { BlockFrame } from './blockstack.js';

export {
  BaseElement,
  HeadingElement,
  ParagraphElement,
  EmphasisElement,
  LinkElement,
  ImageElement,
  ItemElement,
  TaskElement,
  CodeBlockElement,
  CodeSpanElement,
  StrikethroughElement,
  HRElement,
  TableElement,
  TableCellElement,
  TableRowElement,
  TableHeadElement,
  isChildNode,
  newElement,
} from './elements.js';
export type {
  Element,
  ElementRenderer,
  StyleOverriderElementRenderer,
  ElementFinisher,
} from './elements.js';

export { detect as detectAutolink } from './autolink.js';

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

export { RenderContext, newRenderContext } from './context.js';
export type {
  RenderOptions,
  Options,
  TableContext,
  TableLink,
  TableLinkType,
} from './context.js';

// ─── Renderer (renderer.ts) ─────────────────────────────────────────────────

export {
  ANSIRenderer,
  newRenderer,
  renderNodes,
  render as renderAST,
} from './renderer.js';

// ─── Public API — glamour.ts (main entry points) ───────────────────────────

export {
  TermRenderer,
  newTermRenderer,
  render,
  renderWithStyle,
  renderBytes,
  renderWithEnvironmentConfig,
  withStyles,
  withStandardStyle,
  withStylesFromJSON,
  withStylesFromJSONBytes,
  withStylesFromJSONFile,
  withStylePath,
  withWordWrap,
  withTableWrap,
  withInlineTableLinks,
  withEmoji,
  withChromaFormatter,
  withColorProfile,
  withHyperlinks,
  withPreservedNewLines,
  withBaseURL,
  withEnvironmentConfig,
  withAutoStyle,
  withOptions,
} from './glamour.js';

export type { TermRendererOption } from './glamour.js';
