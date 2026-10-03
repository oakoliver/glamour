// Test helper: tracks the SGR style and OSC 8 hyperlink active in a stream,
// so tests can check what style is open at any point of rendered output.

const ESC_RE = /\x1b\[[0-9;:<=>?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/y;

/** Returns the escape sequence starting at `index`, or '' if there is none. */
export function escapeAt(s: string, index: number): string {
  if (s.charCodeAt(index) !== 0x1b) return '';
  ESC_RE.lastIndex = index;
  const match = ESC_RE.exec(s);
  return match ? match[0] : '';
}

/** Splits SGR parameters into top-level attributes (extended colors stay whole). */
function sgrAttributes(params: string): string[][] {
  const parts = params.split(';');
  const attrs: string[][] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if ((p === '38' || p === '48' || p === '58') && i + 1 < parts.length) {
      const span = parts[i + 1] === '5' ? 3 : parts[i + 1] === '2' ? 5 : 1;
      attrs.push(parts.slice(i, i + span));
      i += span - 1;
    } else {
      attrs.push([p]);
    }
  }
  return attrs;
}

/** The pen: the style and hyperlink in effect after the text seen so far. */
export class Pen {
  private sgr: string[] = [];
  private link = '';

  get isStyled(): boolean {
    return this.sgr.length > 0;
  }

  get isLinked(): boolean {
    return this.link !== '';
  }

  /** Updates the pen with an escape sequence. Other sequences are ignored. */
  advance(seq: string): void {
    if (seq.startsWith('\x1b[') && seq.endsWith('m')) {
      const params = seq.slice(2, -1);
      if (params === '') {
        this.sgr = [];
        return;
      }
      const attrs = sgrAttributes(params);
      let last = -1;
      attrs.forEach((attr, i) => {
        if (attr.length === 1 && (attr[0] === '0' || attr[0] === '')) last = i;
      });
      if (last >= 0) {
        this.sgr = [];
        const rest = attrs.slice(last + 1);
        if (rest.length > 0) this.sgr.push(`\x1b[${rest.flat().join(';')}m`);
      } else {
        this.sgr.push(seq);
      }
    } else if (seq.startsWith('\x1b]8;')) {
      const body = seq.slice(4).replace(/(?:\x07|\x1b\\)$/, '');
      const url = body.slice(body.indexOf(';') + 1);
      this.link = url === '' ? '' : `\x1b]8;${body}\x07`;
    }
  }

  /** Sequences that end the current style and hyperlink. */
  reset(): string {
    return (this.isStyled ? '\x1b[m' : '') + (this.isLinked ? '\x1b]8;;\x07' : '');
  }

  /** Sequences that re-open the current hyperlink and style. */
  restore(): string {
    return this.link + this.sgr.join('');
  }
}
