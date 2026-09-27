// baseelement.ts — ANSI text rendering (SGR sequences, style application)
// Port of charmbracelet/glamour/ansi/baseelement.go + templatehelper.go

import type { StylePrimitive } from './style.js';
import {
  AnsiStyle,
  RESET_STYLE,
  colorSGR,
  strip,
  stringWidth as ansiStringWidth,
  wrap,
} from './ansi.js';

// ─── Public helpers ─────────────────────────────────────────────────────────

/** Remove all ANSI escape sequences from a string (ansi.Strip). */
export function stripAnsi(s: string): string {
  return strip(s);
}

/** Visible cell width of a string, ignoring escape sequences (ansi.StringWidth). */
export function stringWidth(s: string): number {
  return ansiStringWidth(s);
}

/** Remove HTML tags from text. */
export function stripHTML(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

/**
 * Convert a color string to the SGR parameter upstream emits for it
 * (lipgloss.Color semantics), degraded to a terminal color profile.
 *
 * Profiles: 0=no ANSI, 1=ANSI 16 colors, 2=256 colors, 3=TrueColor.
 * Internal profile 4 restricts formatter output to the base ANSI 8 colors.
 */
export function parseColorToSGR(
  color: string,
  background: boolean,
  colorProfile: number = 3,
): string {
  return colorSGR(color, background, colorProfile);
}

/**
 * Build the ansi.Style that renderText applies for a StylePrimitive.
 * Attribute order matches upstream: foreground, background, underline, bold,
 * italic, strikethrough, reverse, blink. (Upstream ignores faint and conceal.)
 */
export function textStyle(style: StylePrimitive, colorProfile: number = 3): AnsiStyle {
  const s = new AnsiStyle();
  if (colorProfile <= 0) return s;
  if (style.color !== undefined) s.add(colorSGR(style.color, false, colorProfile));
  if (style.background_color !== undefined) s.add(colorSGR(style.background_color, true, colorProfile));
  if (style.underline) s.add('4');
  if (style.bold) s.add('1');
  if (style.italic) s.add('3');
  if (style.crossed_out) s.add('9');
  if (style.inverse) s.add('7');
  if (style.blink) s.add('5');
  return s;
}

/** Build the SGR escape sequence pair (open + close) renderText uses. */
export function buildSGR(
  style: StylePrimitive,
  colorProfile: number = 3,
): { open: string; close: string } {
  const s = textStyle(style, colorProfile);
  if (s.isEmpty()) return { open: '', close: '' };
  return { open: s.toString(), close: RESET_STYLE };
}

// ─── Escape Replacer ────────────────────────────────────────────────────────

/** https://www.markdownguide.org/basic-syntax/#characters-you-can-escape */
const ESCAPE_RE = /\\([\\`*_{}[\]<>()#+\-.!|])/g;

/** Replace markdown-escaped characters in one left-to-right pass (strings.Replacer). */
export function escapeReplacer(text: string): string {
  return text.replace(ESCAPE_RE, '$1');
}

// ─── Format Template ────────────────────────────────────────────────────────

/**
 * Process Go-style format templates (formatToken upstream).
 *
 * `{{.text}}` is replaced with the token. As an extension, the helpers
 * `{{Bold "x"}}`, `{{Italic "x"}}`, `{{Underline "x"}}`, `{{CrossOut "x"}}`,
 * `{{Faint "x"}}` and `{{Color "fg" "bg" "x"}}` are supported, as well as
 * `%s` substitution.
 */
export function formatTemplate(
  template: string,
  text: string,
  colorProfile: number = 3,
): string {
  if (template.includes('%s')) {
    return template.replace(/%s/g, text);
  }

  let result = template.replace(/\{\{\s*\.text\s*\}\}/g, text);
  const wrapWith = (sgr: string, t: string): string =>
    colorProfile <= 0 ? t : `\x1b[${sgr}m${t}${RESET_STYLE}`;

  let changed = true;
  while (changed) {
    changed = false;
    const simple: [string, string][] = [
      ['Bold', '1'],
      ['Italic', '3'],
      ['Underline', '4'],
      ['CrossOut', '9'],
      ['Faint', '2'],
    ];
    for (const [name, sgr] of simple) {
      result = result.replace(new RegExp(`\\{\\{${name}\\s+"([^"]*)"\\}\\}`, 'g'), (_m, t: string) => {
        changed = true;
        return wrapWith(sgr, t);
      });
    }
    result = result.replace(
      /\{\{Color\s+"([^"]*)"\s+"([^"]*)"\s+"([^"]*)"\}\}/g,
      (_m, fg: string, bg: string, t: string) => {
        changed = true;
        const params: string[] = [];
        if (fg) params.push(colorSGR(fg, false, colorProfile));
        if (bg) params.push(colorSGR(bg, true, colorProfile));
        const sgr = params.filter(Boolean).join(';');
        return sgr ? wrapWith(sgr, t) : t;
      },
    );
  }

  return result;
}

// ─── Word Wrap ──────────────────────────────────────────────────────────────

/**
 * Wrap text to a cell width at word boundaries (lipgloss.Wrap).
 * ANSI-aware: styles and hyperlinks are closed before each inserted line break
 * and reopened after it. Words wider than the width are hard-wrapped.
 */
export function wordWrap(text: string, width: number, breakpoints: string = ''): string {
  if (width <= 0) return text;
  return wrap(text, width, breakpoints);
}

// ─── renderText ─────────────────────────────────────────────────────────────

/** cases.Title: upper-case the first letter of each word, lower-case the rest. */
function toTitleCase(s: string): string {
  return s.replace(/[\p{L}\p{N}][\p{L}\p{N}\p{M}'’]*/gu, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

/**
 * Render text with a StylePrimitive's case transforms and SGR attributes.
 * Port of renderText in baseelement.go (which uses ansi.Style.Styled).
 */
export function renderText(
  text: string,
  style: StylePrimitive,
  colorProfile: number = 3,
): string {
  if (text.length === 0) return '';

  let s = text;
  if (style.upper) s = s.toUpperCase();
  if (style.lower) s = s.toLowerCase();
  if (style.title) s = toTitleCase(s);
  return textStyle(style, colorProfile).styled(s);
}

/**
 * Render a token the way BaseElement.doRender does:
 *
 *   prefix (st1) + block_prefix (st1) + styled prefix (st2) +
 *   formatted token (st2) + styled suffix (st2) + block_suffix (st1) + suffix (st1)
 *
 * @param token         The text token to render
 * @param elementPrefix Prefix from the element itself, rendered with st1
 * @param elementSuffix Suffix from the element itself, rendered with st1
 * @param st1           The enclosing block's style
 * @param st2           The element's cascaded style
 */
export function renderElement(
  token: string,
  elementPrefix: string,
  elementSuffix: string,
  st1: StylePrimitive,
  st2: StylePrimitive,
  colorProfile: number = 3,
): string {
  let result = '';
  result += renderText(elementPrefix, st1, colorProfile);
  result += renderText(st2.block_prefix ?? '', st1, colorProfile);
  result += renderText(st2.prefix ?? '', st2, colorProfile);

  let s = token;
  if (st2.format) s = formatTemplate(st2.format, s, colorProfile);
  result += renderText(escapeReplacer(s), st2, colorProfile);

  result += renderText(st2.suffix ?? '', st2, colorProfile);
  result += renderText(st2.block_suffix ?? '', st1, colorProfile);
  result += renderText(elementSuffix, st1, colorProfile);
  return result;
}
