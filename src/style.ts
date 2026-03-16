// Style types — direct port of charmbracelet/glamour/ansi/style.go

/** Chroma holds all the chroma syntax highlighting settings. */
export interface Chroma {
  text?: StylePrimitive;
  error?: StylePrimitive;
  comment?: StylePrimitive;
  comment_preproc?: StylePrimitive;
  keyword?: StylePrimitive;
  keyword_reserved?: StylePrimitive;
  keyword_namespace?: StylePrimitive;
  keyword_type?: StylePrimitive;
  operator?: StylePrimitive;
  punctuation?: StylePrimitive;
  name?: StylePrimitive;
  name_builtin?: StylePrimitive;
  name_tag?: StylePrimitive;
  name_attribute?: StylePrimitive;
  name_class?: StylePrimitive;
  name_constant?: StylePrimitive;
  name_decorator?: StylePrimitive;
  name_exception?: StylePrimitive;
  name_function?: StylePrimitive;
  name_other?: StylePrimitive;
  literal?: StylePrimitive;
  literal_number?: StylePrimitive;
  literal_date?: StylePrimitive;
  literal_string?: StylePrimitive;
  literal_string_escape?: StylePrimitive;
  generic_deleted?: StylePrimitive;
  generic_emph?: StylePrimitive;
  generic_inserted?: StylePrimitive;
  generic_strong?: StylePrimitive;
  generic_subheading?: StylePrimitive;
  background?: StylePrimitive;
}

/** StylePrimitive holds all the basic style settings. */
export interface StylePrimitive {
  block_prefix?: string;
  block_suffix?: string;
  prefix?: string;
  suffix?: string;
  color?: string;
  background_color?: string;
  underline?: boolean;
  bold?: boolean;
  upper?: boolean;
  lower?: boolean;
  title?: boolean;
  italic?: boolean;
  crossed_out?: boolean;
  faint?: boolean;
  conceal?: boolean;
  inverse?: boolean;
  blink?: boolean;
  format?: string;
}

/** StyleTask holds style settings for a task item. */
export interface StyleTask extends StylePrimitive {
  ticked?: string;
  unticked?: string;
}

/** StyleBlock holds basic style settings for block elements. */
export interface StyleBlock {
  // Embed StylePrimitive fields
  block_prefix?: string;
  block_suffix?: string;
  prefix?: string;
  suffix?: string;
  color?: string;
  background_color?: string;
  underline?: boolean;
  bold?: boolean;
  upper?: boolean;
  lower?: boolean;
  title?: boolean;
  italic?: boolean;
  crossed_out?: boolean;
  faint?: boolean;
  conceal?: boolean;
  inverse?: boolean;
  blink?: boolean;
  format?: string;
  // Block-specific
  indent?: number;
  indent_token?: string;
  margin?: number;
}

/** StyleCodeBlock holds style settings for a code block. */
export interface StyleCodeBlock extends StyleBlock {
  theme?: string;
  chroma?: Chroma;
}

/** StyleList holds style settings for a list. */
export interface StyleList extends StyleBlock {
  level_indent?: number;
}

/** StyleTable holds style settings for a table. */
export interface StyleTable extends StyleBlock {
  center_separator?: string;
  column_separator?: string;
  row_separator?: string;
}

/** StyleConfig is the full style configuration for rendering. */
export interface StyleConfig {
  document?: StyleBlock;
  block_quote?: StyleBlock;
  paragraph?: StyleBlock;
  list?: StyleList;

  heading?: StyleBlock;
  h1?: StyleBlock;
  h2?: StyleBlock;
  h3?: StyleBlock;
  h4?: StyleBlock;
  h5?: StyleBlock;
  h6?: StyleBlock;

  text?: StylePrimitive;
  strikethrough?: StylePrimitive;
  emph?: StylePrimitive;
  strong?: StylePrimitive;
  hr?: StylePrimitive;

  item?: StylePrimitive;
  enumeration?: StylePrimitive;
  task?: StyleTask;

  link?: StylePrimitive;
  link_text?: StylePrimitive;

  image?: StylePrimitive;
  image_text?: StylePrimitive;

  code?: StyleBlock;
  code_block?: StyleCodeBlock;

  table?: StyleTable;

  definition_list?: StyleBlock;
  definition_term?: StylePrimitive;
  definition_description?: StylePrimitive;

  html_block?: StyleBlock;
  html_span?: StyleBlock;
}

// ─── Style Cascading ────────────────────────────────────────────────────────

/** Extract StylePrimitive fields from a StyleBlock. */
export function toStylePrimitive(block: StyleBlock | undefined): StylePrimitive {
  if (!block) return {};
  return {
    block_prefix: block.block_prefix,
    block_suffix: block.block_suffix,
    prefix: block.prefix,
    suffix: block.suffix,
    color: block.color,
    background_color: block.background_color,
    underline: block.underline,
    bold: block.bold,
    upper: block.upper,
    lower: block.lower,
    title: block.title,
    italic: block.italic,
    crossed_out: block.crossed_out,
    faint: block.faint,
    conceal: block.conceal,
    inverse: block.inverse,
    blink: block.blink,
    format: block.format,
  };
}

/** Cascade a child StylePrimitive onto a parent, inheriting non-overridden values. */
export function cascadeStylePrimitive(
  parent: StylePrimitive,
  child: StylePrimitive,
  toBlock: boolean,
): StylePrimitive {
  const s: StylePrimitive = { ...child };

  // Start with parent values
  s.color = parent.color;
  s.background_color = parent.background_color;
  s.underline = parent.underline;
  s.bold = parent.bold;
  s.upper = parent.upper;
  s.title = parent.title;
  s.lower = parent.lower;
  s.italic = parent.italic;
  s.crossed_out = parent.crossed_out;
  s.faint = parent.faint;
  s.conceal = parent.conceal;
  s.inverse = parent.inverse;
  s.blink = parent.blink;

  if (toBlock) {
    s.block_prefix = parent.block_prefix;
    s.block_suffix = parent.block_suffix;
    s.prefix = parent.prefix;
    s.suffix = parent.suffix;
  }

  // Override with child values where defined
  if (child.color !== undefined) s.color = child.color;
  if (child.background_color !== undefined) s.background_color = child.background_color;
  if (child.underline !== undefined) s.underline = child.underline;
  if (child.bold !== undefined) s.bold = child.bold;
  if (child.upper !== undefined) s.upper = child.upper;
  if (child.lower !== undefined) s.lower = child.lower;
  if (child.title !== undefined) s.title = child.title;
  if (child.italic !== undefined) s.italic = child.italic;
  if (child.crossed_out !== undefined) s.crossed_out = child.crossed_out;
  if (child.faint !== undefined) s.faint = child.faint;
  if (child.conceal !== undefined) s.conceal = child.conceal;
  if (child.inverse !== undefined) s.inverse = child.inverse;
  if (child.blink !== undefined) s.blink = child.blink;
  if (child.block_prefix) s.block_prefix = child.block_prefix;
  if (child.block_suffix) s.block_suffix = child.block_suffix;
  if (child.prefix) s.prefix = child.prefix;
  if (child.suffix) s.suffix = child.suffix;
  if (child.format) s.format = child.format;

  return s;
}

/** Cascade multiple StylePrimitives. */
export function cascadeStylePrimitives(...styles: StylePrimitive[]): StylePrimitive {
  let r: StylePrimitive = {};
  for (const v of styles) {
    r = cascadeStylePrimitive(r, v, true);
  }
  return r;
}

/** Cascade a child StyleBlock onto a parent. */
export function cascadeStyle(
  parent: StyleBlock,
  child: StyleBlock,
  toBlock: boolean,
): StyleBlock {
  const s: StyleBlock = { ...child };

  // Cascade primitives
  const cascaded = cascadeStylePrimitive(
    toStylePrimitive(parent),
    toStylePrimitive(child),
    toBlock,
  );
  Object.assign(s, cascaded);

  if (toBlock) {
    s.indent = parent.indent;
    s.margin = parent.margin;
  }

  if (child.indent !== undefined) s.indent = child.indent;

  return s;
}

/** Cascade multiple StyleBlocks. */
export function cascadeStyles(...styles: StyleBlock[]): StyleBlock {
  let r: StyleBlock = {};
  for (const v of styles) {
    r = cascadeStyle(r, v, true);
  }
  return r;
}
