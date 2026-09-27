# Changelog

## 2.0.0

Major version: the exported writer classes (`MarginWriter`, `PaddingWriter`,
`IndentWriter`) now take upstream's streaming constructor arguments, `wordWrap`
takes a breakpoints argument, and rendered output changes throughout to match
upstream. The last published release was 1.0.1; 1.1.0 was never published.

Rendering now matches Glamour v2.0.1 byte for byte. The rendering pipeline is
a direct port of upstream's `ansi` package and the parts of `x/ansi`,
`ultraviolet` and Lip Gloss it uses (`ansi.Style`, `ansi.Wrap`,
`lipgloss.Wrap`/`WrapWriter`, the margin/padding/indent writers and
`lipgloss/table`). The parser follows goldmark's inline scanner, so text runs
are split exactly where goldmark splits them, and every run is styled on its
own as upstream does.

- Fix: a horizontal rule printed its format string once per column
  (`HRElement` repeated `"\n--------\n"` across the width), so one `---` became
  several dashed lines. The format is now rendered once.
- Fix: `indent` and `indent_token` were ignored. Block finishing only applied
  `margin`, so nested lists came out flat and blockquotes lost their `│ ` bar.
  Blocks now go through the upstream `MarginWriter` (indent + margin drawn with
  the indent token in the parent style, then padding in the block style).
- Fix: bold and italic lost their theme colors. The emphasis wrapper was drawn
  around text that had already been styled with the text color, so the text
  color won (dracula's orange bold and yellow italic rendered white). Emphasis
  now passes its style down to its children, like upstream's
  `StyleOverrideRender`.
- Fix: highlighted code left SGR styles open across line breaks, tinting the
  margins, and painted the chroma background on every token. Styles are closed
  before each line break and reopened after it (`WrapWriter`), and the
  background is cleared as chroma's terminal formatters do. Tokens are written
  the way chroma writes them (`ESC[…m` + text + `ESC[0m`, colors mapped through
  chroma's terminal palettes), and unknown or missing languages render as
  plain text like chroma's fallback lexer. Upstream v2.0.1 itself does not
  re-indent the continuation of a wrapped code line (the wrap happens after the
  code block's indentation), and this port keeps that behavior.
- Fix: SGR sequences match upstream: attributes in upstream order (color,
  background, underline, bold, italic, …), `ESC[m` resets, colors 0–15 as basic
  ANSI colors, and no `faint`/`conceal` (upstream ignores them).
- Fix: paragraphs and headings pad every line to the full width with styled
  spaces, and the document margin/wrapping follows upstream exactly (including
  wrapping at `" ,.;-+|"` breakpoints).
- Fix: tables are laid out by a port of `lipgloss/table` (column sizing,
  alignment, header truncation, borders, base-style backgrounds).
- Fix: parser differences from goldmark: `***x***` and `*a **b** c*` nest
  emphasis correctly; a bullet list ends at an ordered item instead of
  swallowing it as a lazy continuation; nested list items are matched by
  content column; table header cells sit directly under the header; tight
  definition descriptions are text blocks; lone HTML tags (CommonMark type 7)
  form HTML blocks; linkify follows goldmark (and is off inside open link
  labels); soft and hard line breaks are flags on the preceding text.
- Fix: relative links resolve like Go's `url.ResolveReference`, also without a
  base URL; code spans and HTML blocks decode entities like `html.UnescapeString`.
- Fix: `withStylesFromJSONFile` reads the file when the option is applied (and
  throws `glamour: error reading file` then), not when it is created. JSON style
  options merge into previously set styles, like `json.Unmarshal`.
- Changed: the writer classes follow upstream's streaming `io.Writer` API:
  `new PaddingWriter(w, width, padFunc?)`, `new IndentWriter(w, indent,
  indentFunc?)`, `new MarginWriter(ctx, w, rules)`. `wordWrap(text, width,
  breakpoints?)` is `lipgloss.Wrap`. Parsed text keeps backslash escapes
  (removed when rendering, as upstream does), and `softbreak`/`hardbreak`
  nodes are replaced by `softBreak`/`hardBreak` flags on text nodes.
- Tests: golden tests against real Glamour v2.0.1 output: 10 fixtures × 7
  styles × widths 40/80 (140 cases), plus Glamour's own `renderer_test.go`
  corpus (54 cases). All are compared byte for byte, except the SGR sequences
  on syntax-highlighted code lines, since upstream lexes with chroma and this
  port with highlight.js (the text must still match exactly). The Go generator
  is in `tests/golden/generate`.

## 1.1.0

- Port Glamour v2.0.1 option surface and parity fixes.
