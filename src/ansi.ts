// ansi.ts — ANSI primitives used by the renderer.
// Port of the parts of charmbracelet/x/ansi, charmbracelet/ultraviolet and
// charm.land/lipgloss/v2 that glamour's ansi package depends on:
//
//   - ansi.Style / Styled           (SGR builder used by renderText)
//   - ansi.StringWidth / Truncate    (grapheme-aware cell widths)
//   - ansi.Wrap                      (word wrapping with breakpoints)
//   - uv.Style / uv.ReadStyle        (pen state tracked across line breaks)
//   - lipgloss.WrapWriter / Wrap     (close and reopen styles around newlines)
//
// The byte output of these helpers is what upstream glamour emits, so they
// are kept deliberately literal.

/** ansi.ResetStyle */
export const RESET_STYLE = '\x1b[m';

/** A destination for rendered output (Go's io.Writer). */
export interface Writer {
  write(s: string): void;
}

/** An in-memory writer, the equivalent of a bytes.Buffer. */
export class StringWriter implements Writer {
  value = '';

  write(s: string): void {
    this.value += s;
  }

  toString(): string {
    return this.value;
  }
}

// ─── Hyperlinks ──────────────────────────────────────────────────────────────

/** ansi.SetHyperlink */
export function setHyperlink(uri: string, ...params: string[]): string {
  return `\x1b]8;${params.join(':')};${uri}\x07`;
}

/** ansi.ResetHyperlink */
export function resetHyperlink(): string {
  return setHyperlink('');
}

// ─── Escape sequence scanning ───────────────────────────────────────────────

/**
 * Returns the index just past the escape sequence that starts at s[i]
 * (s[i] must be ESC). Unterminated sequences run to the end of the string.
 */
export function escapeEnd(s: string, i: number): number {
  const next = s[i + 1];
  if (next === undefined) return i + 1;
  if (next === '[') {
    // CSI: parameters/intermediates, then a final byte in 0x40–0x7E.
    let j = i + 2;
    while (j < s.length) {
      const c = s.charCodeAt(j);
      j++;
      if (c >= 0x40 && c <= 0x7e) return j;
    }
    return j;
  }
  if (next === ']' || next === 'P' || next === 'X' || next === '^' || next === '_') {
    // OSC/DCS/SOS/PM/APC: terminated by BEL (OSC) or ST (ESC \).
    let j = i + 2;
    while (j < s.length) {
      if (s[j] === '\x07' && next === ']') return j + 1;
      if (s[j] === '\x1b' && s[j + 1] === '\\') return j + 2;
      j++;
    }
    return j;
  }
  // Two-byte (or intermediate-prefixed) escape sequence.
  let j = i + 1;
  while (j < s.length && s.charCodeAt(j) >= 0x20 && s.charCodeAt(j) <= 0x2f) j++;
  return Math.min(j + 1, s.length);
}

const ESCAPE_RE = /\x1b(?:\[[\x20-\x3f]*[\x40-\x7e]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[PX^_][^\x1b]*\x1b\\|[\x20-\x2f]*[\x30-\x7e])/g;

/** ansi.Strip: remove escape sequences. */
export function strip(s: string): string {
  return s.replace(ESCAPE_RE, '');
}

// ─── Grapheme widths ────────────────────────────────────────────────────────

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

const ZERO_WIDTH_RE = /^[\p{Mn}\p{Me}\p{Cf}\u200b\u2028\u2029]/u;
const EMOJI_PRESENTATION_RE = /\p{Emoji_Presentation}|\ufe0f/u;

/** Returns true for East Asian Wide/Fullwidth code points. */
function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x231a && cp <= 0x231b) ||
    (cp >= 0x2329 && cp <= 0x232a) ||
    (cp >= 0x23e9 && cp <= 0x23ec) ||
    cp === 0x23f0 || cp === 0x23f3 ||
    (cp >= 0x25fd && cp <= 0x25fe) ||
    (cp >= 0x2614 && cp <= 0x2615) ||
    (cp >= 0x2648 && cp <= 0x2653) ||
    cp === 0x267f || cp === 0x2693 || cp === 0x26a1 ||
    (cp >= 0x26aa && cp <= 0x26ab) ||
    (cp >= 0x26bd && cp <= 0x26be) ||
    (cp >= 0x26c4 && cp <= 0x26c5) ||
    cp === 0x26ce || cp === 0x26d4 || cp === 0x26ea ||
    (cp >= 0x26f2 && cp <= 0x26f3) ||
    cp === 0x26f5 || cp === 0x26fa || cp === 0x26fd ||
    cp === 0x2705 ||
    (cp >= 0x270a && cp <= 0x270b) ||
    cp === 0x2728 || cp === 0x274c || cp === 0x274e ||
    (cp >= 0x2753 && cp <= 0x2755) ||
    cp === 0x2757 ||
    (cp >= 0x2795 && cp <= 0x2797) ||
    cp === 0x27b0 || cp === 0x27bf ||
    (cp >= 0x2b1b && cp <= 0x2b1c) ||
    cp === 0x2b50 || cp === 0x2b55 ||
    (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xa960 && cp <= 0xa97f) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe10 && cp <= 0xfe19) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x16fe0 && cp <= 0x16fe4) ||
    (cp >= 0x17000 && cp <= 0x18cff) ||
    (cp >= 0x1b000 && cp <= 0x1b2ff) ||
    (cp >= 0x1f004 && cp <= 0x1f004) ||
    cp === 0x1f0cf || cp === 0x1f18e ||
    (cp >= 0x1f191 && cp <= 0x1f19a) ||
    (cp >= 0x1f200 && cp <= 0x1f251) ||
    (cp >= 0x1f300 && cp <= 0x1f64f) ||
    (cp >= 0x1f680 && cp <= 0x1f6ff) ||
    (cp >= 0x1f900 && cp <= 0x1f9ff) ||
    (cp >= 0x1fa70 && cp <= 0x1faff) ||
    (cp >= 0x20000 && cp <= 0x2fffd) ||
    (cp >= 0x30000 && cp <= 0x3fffd)
  );
}

/** Cell width of one grapheme cluster (ansi.GraphemeWidth). */
export function graphemeWidth(cluster: string): number {
  const cp = cluster.codePointAt(0);
  if (cp === undefined) return 0;
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0;
  if (cp < 0x7f && cluster.length === 1) return 1;
  if (EMOJI_PRESENTATION_RE.test(cluster)) return 2;
  if (isWide(cp)) return 2;
  if (ZERO_WIDTH_RE.test(cluster)) return 0;
  return 1;
}

/** A printable unit of a string: an escape sequence or a grapheme cluster. */
export interface AnsiUnit {
  /** The raw text of the unit. */
  value: string;
  /** True when the unit is an escape sequence (or a stray control byte). */
  escape: boolean;
}

/**
 * Split a string into escape sequences and grapheme clusters, the way the
 * x/ansi parser walks it. ASCII characters are always their own unit, like
 * the byte-oriented Go parser; non-ASCII runs are split into graphemes.
 */
export function ansiUnits(s: string): AnsiUnit[] {
  const units: AnsiUnit[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s.charCodeAt(i);
    if (c === 0x1b) {
      const end = escapeEnd(s, i);
      units.push({ value: s.slice(i, end), escape: true });
      i = end;
      continue;
    }
    if (c < 0x80) {
      units.push({ value: s[i], escape: false });
      i++;
      continue;
    }
    // Non-ASCII run up to the next ASCII byte or escape.
    let j = i + 1;
    while (j < s.length && s.charCodeAt(j) >= 0x80) j++;
    for (const { segment } of segmenter.segment(s.slice(i, j))) {
      units.push({ value: segment, escape: false });
    }
    i = j;
  }
  return units;
}

/** ansi.StringWidth: printable cell width, ignoring escape sequences. */
export function stringWidth(s: string): number {
  if (s === '') return 0;
  let width = 0;
  for (const unit of ansiUnits(s)) {
    if (!unit.escape) width += graphemeWidth(unit.value);
  }
  return width;
}

/** ansi.Truncate: cut a string to a cell width, appending tail when cut. */
export function truncate(s: string, length: number, tail: string): string {
  if (stringWidth(s) <= length) return s;
  const tw = stringWidth(tail);
  length -= tw;
  if (length < 0) return '';

  let out = '';
  let curWidth = 0;
  let ignoring = false;
  for (const unit of ansiUnits(s)) {
    if (unit.escape) {
      out += unit.value;
      continue;
    }
    const code = unit.value.charCodeAt(0);
    if (code >= 0x80) {
      curWidth += graphemeWidth(unit.value);
      if (ignoring) continue;
      if (curWidth > length) {
        ignoring = true;
        out += tail;
        continue;
      }
      out += unit.value;
      continue;
    }
    if (code >= 0x20 && code !== 0x7f) {
      // print action
      if (curWidth >= length && !ignoring) {
        ignoring = true;
        out += tail;
      }
      if (ignoring) continue;
      curWidth++;
      out += unit.value;
    } else {
      // execute action (controls)
      if (ignoring) continue;
      out += unit.value;
    }
    if (curWidth > length && !ignoring) {
      ignoring = true;
      out += tail;
    }
  }
  return out;
}

// ─── Colors ─────────────────────────────────────────────────────────────────

/** Named ANSI colors accepted in addition to upstream's numeric/hex forms. */
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

type ParsedColor =
  | { kind: 'basic'; index: number }
  | { kind: 'indexed'; index: number }
  | { kind: 'rgb'; r: number; g: number; b: number };

/** lipgloss.Color: "#rrggbb"/"#rgb", ANSI (0–15), ANSI256 (16–255), or a packed RGB integer. */
function parseColor(value: string): ParsedColor | undefined {
  if (value.startsWith('#')) {
    let hex = value.slice(1);
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return undefined;
    return {
      kind: 'rgb',
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  const named = NAMED_COLORS[value.toLowerCase()];
  if (named !== undefined) return { kind: 'basic', index: named };
  if (!/^-?\d+$/.test(value)) return undefined;
  const i = Math.abs(Number(value));
  if (i < 16) return { kind: 'basic', index: i };
  if (i < 256) return { kind: 'indexed', index: i };
  return { kind: 'rgb', r: (i >> 16) & 0xff, g: (i >> 8) & 0xff, b: i & 0xff };
}

const ANSI16_RGB: [number, number, number][] = [
  [0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0],
  [0, 0, 128], [128, 0, 128], [0, 128, 128], [192, 192, 192],
  [128, 128, 128], [255, 0, 0], [0, 255, 0], [255, 255, 0],
  [0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
];

function xterm256ToRGB(index: number): [number, number, number] {
  if (index < 16) return ANSI16_RGB[index];
  if (index >= 232) {
    const value = 8 + (index - 232) * 10;
    return [value, value, value];
  }
  const cube = index - 16;
  const levels = [0, 95, 135, 175, 215, 255];
  return [levels[Math.floor(cube / 36)], levels[Math.floor(cube / 6) % 6], levels[cube % 6]];
}

function rgbToXterm256(r: number, g: number, b: number): number {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round((r - 8) / 10) + 232;
  }
  const toCube = (value: number): number => Math.round(value / 255 * 5);
  return 16 + 36 * toCube(r) + 6 * toCube(g) + toCube(b);
}

function nearestAnsi16([r, g, b]: [number, number, number]): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < 16; index++) {
    const [cr, cg, cb] = ANSI16_RGB[index];
    const distance = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

function basicColorSGR(index: number, background: boolean): string {
  if (index < 8) return String((background ? 40 : 30) + index);
  return String((background ? 100 : 90) + index - 8);
}

/**
 * The SGR parameter for a color (x/ansi foregroundColorString /
 * backgroundColorString), degraded to the given color profile:
 * 0 = no color, 1 = ANSI 16, 2 = ANSI 256, 3 = TrueColor (upstream default),
 * 4 = the base 8 ANSI colors (chroma's "terminal8" formatter).
 */
export function colorSGR(value: string, background: boolean, profile = 3): string {
  if (profile <= 0) return '';
  const color = parseColor(value);
  if (!color) return '';
  const prefix = background ? '48' : '38';

  if (profile === 1 || profile === 4) {
    let index = color.kind === 'rgb'
      ? nearestAnsi16([color.r, color.g, color.b])
      : color.kind === 'basic' ? color.index : nearestAnsi16(xterm256ToRGB(color.index));
    if (profile === 4) index %= 8;
    return basicColorSGR(index, background);
  }
  if (color.kind === 'basic') return basicColorSGR(color.index, background);
  if (color.kind === 'indexed') return `${prefix};5;${color.index}`;
  if (profile === 2) return `${prefix};5;${rgbToXterm256(color.r, color.g, color.b)}`;
  return `${prefix};2;${color.r};${color.g};${color.b}`;
}

// ─── ansi.Style ─────────────────────────────────────────────────────────────

/** x/ansi Style: an ordered list of SGR attributes. */
export class AnsiStyle {
  readonly attrs: string[] = [];

  add(attr: string): this {
    if (attr) this.attrs.push(attr);
    return this;
  }

  isEmpty(): boolean {
    return this.attrs.length === 0;
  }

  /** Style.String */
  toString(): string {
    if (this.attrs.length === 0) return RESET_STYLE;
    return `\x1b[${this.attrs.join(';')}m`;
  }

  /** Style.Styled */
  styled(s: string): string {
    if (this.attrs.length === 0) return s;
    return this.toString() + s + RESET_STYLE;
  }
}

// ─── uv.Style (pen state) ───────────────────────────────────────────────────

const ATTR_BOLD = 1 << 0;
const ATTR_FAINT = 1 << 1;
const ATTR_ITALIC = 1 << 2;
const ATTR_BLINK = 1 << 3;
const ATTR_RAPID_BLINK = 1 << 4;
const ATTR_REVERSE = 1 << 5;
const ATTR_CONCEAL = 1 << 6;
const ATTR_STRIKETHROUGH = 1 << 7;

interface Param {
  value: number;
  hasMore: boolean;
  missing: boolean;
}

function parseParams(raw: string): Param[] {
  if (raw === '') return [];
  const params: Param[] = [];
  let current = '';
  for (let i = 0; i <= raw.length; i++) {
    const c = raw[i];
    if (c === ';' || c === ':' || c === undefined) {
      params.push({
        value: current === '' ? 0 : Number(current),
        missing: current === '',
        hasMore: c === ':',
      });
      current = '';
    } else {
      current += c;
    }
  }
  return params;
}

/** ansi.ReadStyleColor: returns [sgr color attribute, params consumed]. */
function readStyleColor(params: Param[], i: number): [string, number] {
  const kind = params[i].value; // 38, 48 or 58
  const mode = params[i + 1];
  if (!mode) return ['', 0];
  if (mode.value === 5 && params[i + 2] && !params[i + 2].missing) {
    return [`${kind};5;${params[i + 2].value}`, 3];
  }
  if (mode.value === 2 && params.length >= i + 5) {
    const [r, g, b] = [params[i + 2].value, params[i + 3].value, params[i + 4].value];
    return [`${kind};2;${r};${g};${b}`, 5];
  }
  return ['', 0];
}

/** uv.Style: the SGR pen state tracked by lipgloss.WrapWriter. */
export class Pen {
  fg = '';
  bg = '';
  ulColor = '';
  underline = 0;
  attrs = 0;

  isZero(): boolean {
    return !this.fg && !this.bg && !this.ulColor && this.underline === 0 && this.attrs === 0;
  }

  reset(): void {
    this.fg = '';
    this.bg = '';
    this.ulColor = '';
    this.underline = 0;
    this.attrs = 0;
  }

  /** uv.ReadStyle */
  read(rawParams: string): void {
    const params = parseParams(rawParams);
    if (params.length === 0) {
      this.reset();
      return;
    }
    for (let i = 0; i < params.length; i++) {
      const { value, hasMore } = params[i];
      switch (value) {
        case 0: this.reset(); break;
        case 1: this.attrs |= ATTR_BOLD; break;
        case 2: this.attrs |= ATTR_FAINT; break;
        case 3: this.attrs |= ATTR_ITALIC; break;
        case 4: {
          const next = params[i + 1];
          if (hasMore && next && next.value >= 0 && next.value <= 5) {
            i++;
            this.underline = next.value;
          } else {
            this.underline = 1;
          }
          break;
        }
        case 5: this.attrs |= ATTR_BLINK; break;
        case 6: this.attrs |= ATTR_RAPID_BLINK; break;
        case 7: this.attrs |= ATTR_REVERSE; break;
        case 8: this.attrs |= ATTR_CONCEAL; break;
        case 9: this.attrs |= ATTR_STRIKETHROUGH; break;
        case 22: this.attrs &= ~(ATTR_BOLD | ATTR_FAINT); break;
        case 23: this.attrs &= ~ATTR_ITALIC; break;
        case 24: this.underline = 0; break;
        case 25: this.attrs &= ~(ATTR_BLINK | ATTR_RAPID_BLINK); break;
        case 27: this.attrs &= ~ATTR_REVERSE; break;
        case 28: this.attrs &= ~ATTR_CONCEAL; break;
        case 29: this.attrs &= ~ATTR_STRIKETHROUGH; break;
        case 38: case 48: case 58: {
          const [color, n] = readStyleColor(params, i);
          if (n > 0) {
            if (value === 38) this.fg = color;
            else if (value === 48) this.bg = color;
            else this.ulColor = color;
            i += n - 1;
          }
          break;
        }
        case 39: this.fg = ''; break;
        case 49: this.bg = ''; break;
        case 59: this.ulColor = ''; break;
        default:
          if (value >= 30 && value <= 37) this.fg = String(value);
          else if (value >= 40 && value <= 47) this.bg = String(value);
          else if (value >= 90 && value <= 97) this.fg = String(value);
          else if (value >= 100 && value <= 107) this.bg = String(value);
      }
    }
  }

  /** uv.Style.String */
  toString(): string {
    if (this.isZero()) return RESET_STYLE;
    const s = new AnsiStyle();
    if (this.attrs & ATTR_BOLD) s.add('1');
    if (this.attrs & ATTR_FAINT) s.add('2');
    if (this.attrs & ATTR_ITALIC) s.add('3');
    if (this.attrs & ATTR_BLINK) s.add('5');
    if (this.attrs & ATTR_RAPID_BLINK) s.add('6');
    if (this.attrs & ATTR_REVERSE) s.add('7');
    if (this.attrs & ATTR_CONCEAL) s.add('8');
    if (this.attrs & ATTR_STRIKETHROUGH) s.add('9');
    if (this.underline === 1) s.add('4');
    else if (this.underline > 1) s.add(`4:${this.underline}`);
    s.add(this.fg);
    s.add(this.bg);
    s.add(this.ulColor);
    return s.toString();
  }
}

/** uv.Link */
export interface Link {
  url: string;
  params: string;
}

// ─── lipgloss.WrapWriter ────────────────────────────────────────────────────

/**
 * WrapWriter tracks the SGR pen and OSC 8 hyperlink state of everything
 * written through it. At every newline it resets the style and link, writes
 * the newline, and then restores them, so styles never bleed into margins.
 */
export class WrapWriter implements Writer {
  private readonly pen = new Pen();
  private currentLink: Link = { url: '', params: '' };
  private seq = '';
  private closed = false;

  constructor(private readonly w: Writer) {}

  /** The current pen style. */
  style(): Pen {
    return this.pen;
  }

  /** The current hyperlink. */
  link(): Link {
    return this.currentLink;
  }

  private linkIsZero(): boolean {
    return this.currentLink.url === '' && this.currentLink.params === '';
  }

  private advance(c: string): void {
    if (this.seq === '') {
      if (c === '\x1b') this.seq = c;
      return;
    }
    this.seq += c;
    const kind = this.seq[1];
    if (this.seq.length === 2) {
      if (kind !== '[' && kind !== ']' && kind !== 'P' && kind !== 'X' && kind !== '^' && kind !== '_' &&
        !(c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) <= 0x2f)) {
        this.seq = '';
      }
      return;
    }
    if (kind === '[') {
      const code = c.charCodeAt(0);
      if (code >= 0x40 && code <= 0x7e) {
        const body = this.seq.slice(2, -1);
        if (c === 'm' && /^[0-9;:]*$/.test(body)) this.pen.read(body);
        this.seq = '';
      }
      return;
    }
    if (kind === ']' || kind === 'P' || kind === 'X' || kind === '^' || kind === '_') {
      let data: string | undefined;
      if (c === '\x07' && kind === ']') data = this.seq.slice(2, -1);
      else if (c === '\\' && this.seq[this.seq.length - 2] === '\x1b') data = this.seq.slice(2, -2);
      if (data === undefined) return;
      if (kind === ']') this.readOsc(data);
      this.seq = '';
      return;
    }
    // Intermediate-prefixed escape: finished at the first final byte.
    const code = c.charCodeAt(0);
    if (!(code >= 0x20 && code <= 0x2f)) this.seq = '';
  }

  /** uv.ReadLink */
  private readOsc(data: string): void {
    const parts = data.split(';');
    if (parts[0] !== '8' || parts.length !== 3) return;
    this.currentLink = { params: parts[1], url: parts[2] };
  }

  write(s: string): void {
    if (this.closed) return;
    // Fast path: plain text cannot change the pen or need newline handling.
    if (this.seq === '' && s.indexOf('\x1b') === -1 && s.indexOf('\n') === -1) {
      if (s) this.w.write(s);
      return;
    }
    let out = '';
    for (const c of s) {
      this.advance(c);
      if (c === '\n') {
        if (!this.pen.isZero()) out += RESET_STYLE;
        if (!this.linkIsZero()) out += resetHyperlink();
      }
      out += c;
      if (c === '\n') {
        if (!this.linkIsZero()) out += setHyperlink(this.currentLink.url, this.currentLink.params);
        if (!this.pen.isZero()) out += this.pen.toString();
      }
    }
    if (out) this.w.write(out);
  }

  close(): void {
    if (this.closed) return;
    if (!this.pen.isZero()) this.w.write(RESET_STYLE);
    if (!this.linkIsZero()) this.w.write(resetHyperlink());
    this.closed = true;
  }
}

// ─── ansi.Wrap / lipgloss.Wrap ──────────────────────────────────────────────

const NBSP = '\u00a0';

/** unicode.IsSpace */
function isSpace(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp < 0x80) return cp === 0x20 || (cp >= 0x09 && cp <= 0x0d);
  return cp === 0x85 || cp === 0xa0 || cp === 0x1680 || (cp >= 0x2000 && cp <= 0x200a) ||
    cp === 0x2028 || cp === 0x2029 || cp === 0x202f || cp === 0x205f || cp === 0x3000;
}

/**
 * ansi.Wrap: wrap a string to a cell width, preserving escape sequences.
 * Words are broken at spaces, hyphens, and the given breakpoint characters;
 * words longer than the limit are hard-wrapped.
 */
export function ansiWrap(s: string, limit: number, breakpoints: string): string {
  if (limit < 1) return s;
  const breaks = new Set(Array.from(breakpoints));

  let buf = '';
  let word = '';
  let space = '';
  let spaceWidth = 0;
  let curWidth = 0;
  let wordLen = 0;

  const addSpace = (): void => {
    if (spaceWidth === 0 && space.length === 0) return;
    curWidth += spaceWidth;
    buf += space;
    space = '';
    spaceWidth = 0;
  };
  const addWord = (): void => {
    if (word.length === 0) return;
    addSpace();
    curWidth += wordLen;
    buf += word;
    word = '';
    wordLen = 0;
  };
  const addNewline = (): void => {
    buf += '\n';
    curWidth = 0;
    space = '';
    spaceWidth = 0;
  };

  for (const unit of ansiUnits(s)) {
    if (unit.escape) {
      word += unit.value;
      continue;
    }
    const cluster = unit.value;
    const code = cluster.charCodeAt(0);
    if (code >= 0x80) {
      const width = graphemeWidth(cluster);
      const r = String.fromCodePoint(cluster.codePointAt(0) ?? 0);
      if (isSpace(r) && r !== NBSP) {
        addWord();
        space += r;
        spaceWidth += width;
      } else if (Array.from(cluster).some((ch) => breaks.has(ch))) {
        addSpace();
        if (curWidth + wordLen + width > limit) {
          word += cluster;
          wordLen += width;
        } else {
          addWord();
          buf += cluster;
          curWidth += width;
        }
      } else {
        if (wordLen + width > limit) addWord();
        word += cluster;
        wordLen += width;
        if (curWidth + wordLen + spaceWidth > limit) addNewline();
        if (wordLen === limit) addWord();
      }
      continue;
    }

    if (code >= 0x20 && code !== 0x7f || isControlAction(code)) {
      if (cluster === '\n') {
        if (wordLen === 0) {
          if (curWidth + spaceWidth > limit) curWidth = 0;
          else buf += space;
          space = '';
          spaceWidth = 0;
        }
        addWord();
        addNewline();
      } else if (isSpace(cluster)) {
        addWord();
        space += cluster;
        spaceWidth++;
      } else if (cluster === '-' || breaks.has(cluster)) {
        addSpace();
        if (curWidth + wordLen >= limit) {
          word += cluster;
          wordLen++;
        } else {
          addWord();
          buf += cluster;
          curWidth++;
        }
      } else {
        if (curWidth === limit) addNewline();
        word += cluster;
        wordLen++;
        if (wordLen === limit) addWord();
        if (curWidth + wordLen + spaceWidth > limit) addNewline();
      }
    } else {
      word += cluster;
    }
  }

  if (wordLen === 0) {
    if (curWidth + spaceWidth > limit) curWidth = 0;
    else buf += space;
    space = '';
    spaceWidth = 0;
  }
  addWord();
  return buf;
}

/** C0 controls the x/ansi parser executes (everything but ESC, CAN, SUB). */
function isControlAction(code: number): boolean {
  return code < 0x20 && code !== 0x1b && code !== 0x18 && code !== 0x1a;
}

/**
 * lipgloss.Wrap: ansi.Wrap followed by a WrapWriter pass, so styles and
 * hyperlinks are closed before every line break and reopened after it.
 *
 * Upstream returns the buffer before its deferred WrapWriter.Close runs, so a
 * style or link left open by the input is not closed at the end.
 */
export function wrap(s: string, width: number, breakpoints: string): string {
  const out = new StringWriter();
  new WrapWriter(out).write(ansiWrap(s, width, breakpoints));
  return out.value;
}
