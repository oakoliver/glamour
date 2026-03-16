// baseelement.ts — ANSI text rendering (SGR sequences, style application)
// Port of charmbracelet/glamour/ansi/baseelement.go + templatehelper.go

import { StylePrimitive } from './style.js';

// ─── ANSI Helpers ────────────────────────────────────────────────────────────

const ESC = '\x1b[';
const RESET = '\x1b[0m';

/** Regex matching all ANSI escape sequences (CSI + OSC). */
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]|\x1b\].*?(?:\x1b\\|\x07)/g;

// ─── Named ANSI Colors ──────────────────────────────────────────────────────

const NAMED_COLORS: Record<string, number> = {
  'black': 0,
  'red': 1,
  'green': 2,
  'yellow': 3,
  'blue': 4,
  'magenta': 5,
  'cyan': 6,
  'white': 7,
  'bright-black': 8,
  'bright-red': 9,
  'bright-green': 10,
  'bright-yellow': 11,
  'bright-blue': 12,
  'bright-magenta': 13,
  'bright-cyan': 14,
  'bright-white': 15,
};

// ─── CJK Width Detection ───────────────────────────────────────────────────

/**
 * Returns true if the given code point is a wide (CJK) character.
 */
function isWideChar(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x231a && cp <= 0x231b) ||
    (cp >= 0x2329 && cp <= 0x232a) ||
    (cp >= 0x23e9 && cp <= 0x23f3) ||
    (cp >= 0x23f8 && cp <= 0x23fa) ||
    (cp >= 0x25fd && cp <= 0x25fe) ||
    (cp >= 0x2614 && cp <= 0x2615) ||
    (cp >= 0x2648 && cp <= 0x2653) ||
    (cp >= 0x267f && cp <= 0x267f) ||
    (cp >= 0x2693 && cp <= 0x2693) ||
    (cp >= 0x26a1 && cp <= 0x26a1) ||
    (cp >= 0x26aa && cp <= 0x26ab) ||
    (cp >= 0x26bd && cp <= 0x26be) ||
    (cp >= 0x26c4 && cp <= 0x26c5) ||
    (cp >= 0x26ce && cp <= 0x26ce) ||
    (cp >= 0x26d4 && cp <= 0x26d4) ||
    (cp >= 0x26ea && cp <= 0x26ea) ||
    (cp >= 0x26f2 && cp <= 0x26f3) ||
    (cp >= 0x26f5 && cp <= 0x26f5) ||
    (cp >= 0x26fa && cp <= 0x26fa) ||
    (cp >= 0x26fd && cp <= 0x26fd) ||
    (cp >= 0x2702 && cp <= 0x2702) ||
    (cp >= 0x2705 && cp <= 0x2705) ||
    (cp >= 0x2708 && cp <= 0x270d) ||
    (cp >= 0x270f && cp <= 0x270f) ||
    (cp >= 0x2728 && cp <= 0x2728) ||
    (cp >= 0x274c && cp <= 0x274c) ||
    (cp >= 0x274e && cp <= 0x274e) ||
    (cp >= 0x2753 && cp <= 0x2755) ||
    (cp >= 0x2757 && cp <= 0x2757) ||
    (cp >= 0x2795 && cp <= 0x2797) ||
    (cp >= 0x27b0 && cp <= 0x27b0) ||
    (cp >= 0x27bf && cp <= 0x27bf) ||
    (cp >= 0x2b1b && cp <= 0x2b1c) ||
    (cp >= 0x2b50 && cp <= 0x2b50) ||
    (cp >= 0x2b55 && cp <= 0x2b55) ||
    (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
    (cp >= 0xac00 && cp <= 0xd7af) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe10 && cp <= 0xfe19) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff01 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f004 && cp <= 0x1f004) ||
    (cp >= 0x1f0cf && cp <= 0x1f0cf) ||
    (cp >= 0x1f18e && cp <= 0x1f18e) ||
    (cp >= 0x1f191 && cp <= 0x1f19a) ||
    (cp >= 0x1f200 && cp <= 0x1f202) ||
    (cp >= 0x1f210 && cp <= 0x1f23b) ||
    (cp >= 0x1f240 && cp <= 0x1f248) ||
    (cp >= 0x1f250 && cp <= 0x1f251) ||
    (cp >= 0x1f300 && cp <= 0x1f64f) ||
    (cp >= 0x1f680 && cp <= 0x1f6ff) ||
    (cp >= 0x1f900 && cp <= 0x1f9ff) ||
    (cp >= 0x20000 && cp <= 0x2fffd) ||
    (cp >= 0x30000 && cp <= 0x3fffd)
  );
}

// ─── Public Functions ───────────────────────────────────────────────────────

/**
 * Remove all ANSI escape sequences from a string.
 */
export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '');
}

/**
 * Get the visible width of a string (excluding ANSI escapes).
 * Handles CJK wide characters (width 2).
 */
export function stringWidth(s: string): number {
  const stripped = stripAnsi(s);
  let width = 0;
  for (const char of stripped) {
    const cp = char.codePointAt(0);
    if (cp === undefined) continue;
    // Skip zero-width characters
    if (cp < 32 && cp !== 9) continue; // control chars except tab
    if (cp === 0x200b || cp === 0xfeff) continue; // zero-width space, BOM
    if (isWideChar(cp)) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * Remove HTML tags from text.
 */
export function stripHTML(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

/**
 * Convert a color string to SGR parameter(s).
 *
 * Supports:
 * - "#RRGGBB" / "#RGB" → "38;2;R;G;B" or "48;2;R;G;B"
 * - "0"-"255" → "38;5;N" or "48;5;N"
 * - Named ANSI colors
 */
export function parseColorToSGR(color: string, background: boolean): string {
  const fgBg = background ? 48 : 38;

  // Named color
  const lower = color.toLowerCase();
  if (lower in NAMED_COLORS) {
    return `${fgBg};5;${NAMED_COLORS[lower]}`;
  }

  // Hex color
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `${fgBg};2;${r};${g};${b}`;
    }
  }

  // 256-color index
  const n = parseInt(color, 10);
  if (!isNaN(n) && n >= 0 && n <= 255) {
    return `${fgBg};5;${n}`;
  }

  return '';
}

/**
 * Build an SGR escape sequence pair (open + close) from style attributes.
 */
export function buildSGR(style: StylePrimitive): { open: string; close: string } {
  const params: string[] = [];

  if (style.bold) params.push('1');
  if (style.faint) params.push('2');
  if (style.italic) params.push('3');
  if (style.underline) params.push('4');
  if (style.blink) params.push('5');
  if (style.inverse) params.push('7');
  if (style.conceal) params.push('8');
  if (style.crossed_out) params.push('9');

  if (style.color) {
    const fg = parseColorToSGR(style.color, false);
    if (fg) params.push(fg);
  }
  if (style.background_color) {
    const bg = parseColorToSGR(style.background_color, true);
    if (bg) params.push(bg);
  }

  if (params.length === 0) {
    return { open: '', close: '' };
  }

  return {
    open: `${ESC}${params.join(';')}m`,
    close: RESET,
  };
}

/**
 * Apply SGR styling to a string. Wraps text with open/close sequences.
 */
function applySGR(text: string, style: StylePrimitive): string {
  const { open, close } = buildSGR(style);
  if (!open) return text;
  return `${open}${text}${close}`;
}

// ─── Escape Replacer ────────────────────────────────────────────────────────

/** Markdown escape replacements (backslash-escaped chars). */
const ESCAPE_PAIRS: [string, string][] = [
  ['\\\\', '\\'],
  ['\\`', '`'],
  ['\\*', '*'],
  ['\\_', '_'],
  ['\\{', '{'],
  ['\\}', '}'],
  ['\\[', '['],
  ['\\]', ']'],
  ['\\<', '<'],
  ['\\>', '>'],
  ['\\(', '('],
  ['\\)', ')'],
  ['\\#', '#'],
  ['\\+', '+'],
  ['\\-', '-'],
  ['\\.', '.'],
  ['\\!', '!'],
  ['\\|', '|'],
];

/**
 * Replace markdown-escaped characters.
 */
export function escapeReplacer(text: string): string {
  let result = text;
  for (const [from, to] of ESCAPE_PAIRS) {
    // We need a global replace — split/join is safe and fast
    result = result.split(from).join(to);
  }
  return result;
}

// ─── Format Template ────────────────────────────────────────────────────────

/**
 * Process Go-style format templates.
 *
 * Supported functions:
 *   {{Bold "text"}}           → wrap in bold
 *   {{Italic "text"}}         → wrap in italic
 *   {{Underline "text"}}      → wrap in underline
 *   {{CrossOut "text"}}       → wrap in strikethrough
 *   {{Faint "text"}}          → wrap in faint
 *   {{Color "fg" "bg" "text"}} → wrap in color
 *   {{.text}}                 → the text content placeholder
 */
export function formatTemplate(template: string, text: string): string {
  // Handle Go sprintf-style %s substitution (used in theme format fields)
  if (template.includes('%s')) {
    return template.replace(/%s/g, text);
  }

  // Replace {{.text}} with the actual text
  let result = template.replace(/\{\{\.text\}\}/g, text);

  // Process function calls: {{FuncName "arg1" "arg2" ...}}
  // We loop until no more replacements are made (handles nesting)
  let changed = true;
  while (changed) {
    changed = false;

    // {{Bold "text"}}
    result = result.replace(/\{\{Bold\s+"([^"]*)"\}\}/g, (_m, t: string) => {
      changed = true;
      return `${ESC}1m${t}${RESET}`;
    });

    // {{Italic "text"}}
    result = result.replace(/\{\{Italic\s+"([^"]*)"\}\}/g, (_m, t: string) => {
      changed = true;
      return `${ESC}3m${t}${RESET}`;
    });

    // {{Underline "text"}}
    result = result.replace(/\{\{Underline\s+"([^"]*)"\}\}/g, (_m, t: string) => {
      changed = true;
      return `${ESC}4m${t}${RESET}`;
    });

    // {{CrossOut "text"}}
    result = result.replace(/\{\{CrossOut\s+"([^"]*)"\}\}/g, (_m, t: string) => {
      changed = true;
      return `${ESC}9m${t}${RESET}`;
    });

    // {{Faint "text"}}
    result = result.replace(/\{\{Faint\s+"([^"]*)"\}\}/g, (_m, t: string) => {
      changed = true;
      return `${ESC}2m${t}${RESET}`;
    });

    // {{Color "fg" "bg" "text"}}
    result = result.replace(
      /\{\{Color\s+"([^"]*)"\s+"([^"]*)"\s+"([^"]*)"\}\}/g,
      (_m, fg: string, bg: string, t: string) => {
        changed = true;
        const params: string[] = [];
        if (fg) {
          const fgParam = parseColorToSGR(fg, false);
          if (fgParam) params.push(fgParam);
        }
        if (bg) {
          const bgParam = parseColorToSGR(bg, true);
          if (bgParam) params.push(bgParam);
        }
        if (params.length === 0) return t;
        return `${ESC}${params.join(';')}m${t}${RESET}`;
      },
    );
  }

  return result;
}

// ─── Word Wrap ──────────────────────────────────────────────────────────────

/**
 * Wrap text to fit within a given width.
 * ANSI-aware: escape sequences don't count as width.
 * Handles CJK wide characters.
 */
export function wordWrap(text: string, width: number): string {
  if (width <= 0) return text;

  const lines = text.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (stringWidth(line) <= width) {
      result.push(line);
      continue;
    }

    // We need to wrap this line. Parse into tokens: ANSI sequences and visible segments.
    const wrapped = wrapLine(line, width);
    result.push(wrapped);
  }

  return result.join('\n');
}

/**
 * Wrap a single line that exceeds the width.
 * Preserves ANSI escape sequences across line breaks.
 */
function wrapLine(line: string, width: number): string {
  // Parse line into segments: either ANSI escapes or text chunks
  const segments: Array<{ text: string; isAnsi: boolean }> = [];
  let lastIdx = 0;
  const re = new RegExp(ANSI_RE.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(line)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ text: line.slice(lastIdx, match.index), isAnsi: false });
    }
    segments.push({ text: match[0], isAnsi: true });
    lastIdx = re.lastIndex;
  }
  if (lastIdx < line.length) {
    segments.push({ text: line.slice(lastIdx), isAnsi: false });
  }

  const outputLines: string[] = [];
  let currentLine = '';
  let currentWidth = 0;
  // Track active ANSI state for carry-over across wraps
  let activeAnsi = '';

  for (const seg of segments) {
    if (seg.isAnsi) {
      currentLine += seg.text;
      // Track ANSI state: reset clears, otherwise accumulate
      if (seg.text === RESET) {
        activeAnsi = '';
      } else {
        activeAnsi += seg.text;
      }
      continue;
    }

    // Process visible text character by character
    for (const char of seg.text) {
      if (char === ' ') {
        // Check if we can fit at least the space
        if (currentWidth + 1 > width && currentWidth > 0) {
          // Close any active ANSI before wrapping
          if (activeAnsi) currentLine += RESET;
          outputLines.push(currentLine);
          currentLine = activeAnsi; // Restore ANSI state on new line
          currentWidth = 0;
        }
        currentLine += char;
        currentWidth += 1;
        continue;
      }

      const cp = char.codePointAt(0) ?? 0;
      const charW = isWideChar(cp) ? 2 : 1;

      if (currentWidth + charW > width && currentWidth > 0) {
        // Close any active ANSI before wrapping
        if (activeAnsi) currentLine += RESET;
        outputLines.push(currentLine);
        currentLine = activeAnsi; // Restore ANSI state on new line
        currentWidth = 0;
      }

      currentLine += char;
      currentWidth += charW;
    }
  }

  if (currentLine) {
    outputLines.push(currentLine);
  }

  return outputLines.join('\n');
}

// ─── renderText ─────────────────────────────────────────────────────────────

/**
 * The core function that takes text and a StylePrimitive, and produces
 * fully-styled ANSI output.
 *
 * Pipeline (matching Go baseelement.go):
 * 1. If format template is set, apply it
 * 2. Apply escape replacements
 * 3. Apply case transformations (upper/lower/title)
 * 4. Wrap with block_prefix / block_suffix
 * 5. Wrap with prefix / suffix  (styled with the same SGR)
 * 6. Apply SGR styling to text content
 */
export function renderText(text: string, style: StylePrimitive): string {
  if (text.length === 0) return '';

  let s = text;

  // Case transformations (applied before SGR, matching Go order)
  if (style.upper) {
    s = s.toUpperCase();
  }
  if (style.lower) {
    s = s.toLowerCase();
  }
  if (style.title) {
    s = toTitleCase(s);
  }

  // Apply SGR styling
  s = applySGR(s, style);

  return s;
}

/**
 * Render a BaseElement-like structure: token + prefix/suffix + block prefix/suffix + format.
 *
 * This matches the Go doRender method's behavior:
 *   blockPrefix (parent style) + prefix (element style) + formatted token (element style) + suffix (element style) + blockSuffix (parent style)
 *
 * @param token The text token to render
 * @param elementPrefix  prefix from the element's own Prefix field (rendered with parent style)
 * @param elementSuffix  suffix from the element's own Suffix field (rendered with parent style)
 * @param parentStyle    parent/context style for prefix/suffix and block_prefix/block_suffix
 * @param elementStyle   element style for the token, its prefix/suffix
 */
export function renderElement(
  token: string,
  elementPrefix: string,
  elementSuffix: string,
  parentStyle: StylePrimitive,
  elementStyle: StylePrimitive,
): string {
  let result = '';

  // render unstyled prefix (e.Prefix rendered with parent st1)
  if (elementPrefix) {
    result += renderText(elementPrefix, parentStyle);
  }

  // render block prefix (from element style, rendered with parent style)
  if (elementStyle.block_prefix) {
    result += renderText(elementStyle.block_prefix, parentStyle);
  }

  // render styled prefix
  if (elementStyle.prefix) {
    result += renderText(elementStyle.prefix, elementStyle);
  }

  // Process the token
  let s = token;
  if (elementStyle.format) {
    s = formatTemplate(elementStyle.format, s);
  }
  s = escapeReplacer(s);
  result += renderText(s, elementStyle);

  // render styled suffix
  if (elementStyle.suffix) {
    result += renderText(elementStyle.suffix, elementStyle);
  }

  // render block suffix
  if (elementStyle.block_suffix) {
    result += renderText(elementStyle.block_suffix, parentStyle);
  }

  // render unstyled suffix
  if (elementSuffix) {
    result += renderText(elementSuffix, parentStyle);
  }

  return result;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Simple title case: capitalize the first letter of each word.
 */
function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
