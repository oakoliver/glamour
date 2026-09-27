import { describe, expect, test } from 'bun:test';
import { IndentWriter, MarginWriter, PaddingWriter, type WriterSink } from '../src/writers.js';
import { StringWriter, WrapWriter } from '../src/ansi.js';
import { RenderContext } from '../src/context.js';

// Writers stream like the io.Writer chain in upstream margin.go: nothing is
// buffered, padding happens when a line's newline is written, and
// indentation is written before the first character of each line.

// ─── PaddingWriter ──────────────────────────────────────────────────────────

describe('PaddingWriter', () => {
  test('pads a line to the width when its newline is written', () => {
    const out = new StringWriter();
    const w = new PaddingWriter(out, 10);
    w.write('hello\n');
    expect(out.value).toBe('hello     \n');
  });

  test('pads each line independently', () => {
    const out = new StringWriter();
    const w = new PaddingWriter(out, 8);
    w.write('ab\nabcdef\n\n');
    expect(out.value).toBe('ab      \nabcdef  \n        \n');
  });

  test('does not pad text after the last newline', () => {
    const out = new StringWriter();
    const w = new PaddingWriter(out, 10);
    w.write('hi\nthere');
    expect(out.value).toBe('hi        \nthere');
  });

  test('does not pad lines that already fill the width', () => {
    const out = new StringWriter();
    const w = new PaddingWriter(out, 5);
    w.write('12345\n123456\n');
    expect(out.value).toBe('12345\n123456\n');
  });

  test('measures width without escape sequences', () => {
    const out = new StringWriter();
    const w = new PaddingWriter(out, 6);
    w.write('\x1b[1mbold\x1b[m\n');
    expect(out.value).toBe('\x1b[1mbold\x1b[m  \n');
  });

  test('calls the pad function once per missing cell', () => {
    const out = new StringWriter();
    const w = new PaddingWriter(out, 4, (pw) => pw.write('.'));
    w.write('a\n');
    expect(out.value).toBe('a...\n');
  });

  test('handles zero width', () => {
    const out = new StringWriter();
    const w = new PaddingWriter(out, 0);
    w.write('hello\n');
    expect(out.value).toBe('hello\n');
  });
});

// ─── IndentWriter ───────────────────────────────────────────────────────────

describe('IndentWriter', () => {
  test('indents the first line', () => {
    const out = new StringWriter();
    const w = new IndentWriter(out, 2);
    w.write('hello');
    expect(out.value).toBe('  hello');
  });

  test('indents every line, but not after a trailing newline', () => {
    const out = new StringWriter();
    const w = new IndentWriter(out, 2);
    w.write('line1\nline2\n');
    expect(out.value).toBe('  line1\n  line2\n');
  });

  test('indents empty lines', () => {
    const out = new StringWriter();
    const w = new IndentWriter(out, 1);
    w.write('a\n\nb');
    expect(out.value).toBe(' a\n \n b');
  });

  test('uses the indent function for each unit of indentation', () => {
    const out = new StringWriter();
    const w = new IndentWriter(out, 2, () => out.write('│'));
    w.write('x\ny');
    expect(out.value).toBe('││x\n││y');
  });

  test('closes and reopens an open style around the indentation', () => {
    const out = new StringWriter();
    const w = new IndentWriter(out, 2);
    w.write('\x1b[1mhello\nworld\x1b[m');
    w.close();
    expect(out.value).toBe('  \x1b[1mhello\x1b[m\n\x1b[1m\x1b[m  \x1b[1mworld\x1b[m');
  });

  test('writes nothing for empty input', () => {
    const out = new StringWriter();
    const w = new IndentWriter(out, 4);
    w.write('');
    expect(out.value).toBe('');
  });
});

// ─── MarginWriter ───────────────────────────────────────────────────────────

describe('MarginWriter', () => {
  const context = (): RenderContext => {
    const ctx = new RenderContext({
      styles: {},
      wordWrap: 12,
      colorProfile: 3,
      hyperlinks: true,
      preserveNewLines: false,
    });
    ctx.blockStack.push({ block: '', style: { color: '252', margin: 2 }, margin: true, newline: false });
    return ctx;
  };

  test('indents with the parent style and pads with the block style', () => {
    const ctx = context();
    const out = new StringWriter();
    const mw = new MarginWriter(ctx, out, ctx.blockStack.current().style);
    mw.write('hi\n');
    mw.close();
    const pad = '\x1b[38;5;252m \x1b[m';
    // width = 12 - 2*2 margin = 8: "hi" + 6 padding cells
    expect(out.value).toBe(`  hi${pad.repeat(6)}\n`);
  });

  test('draws the indent token', () => {
    const ctx = context();
    const quote = { indent: 1, indent_token: '│ ' };
    ctx.blockStack.push({ block: '', style: quote, margin: true, newline: false });
    const out = new StringWriter();
    const mw = new MarginWriter(ctx, out, quote);
    mw.write('a\nb\n');
    mw.close();
    // width = 12 - indent 1 - 2*2 margin = 7: "a" + 6 padding cells
    expect(out.value).toBe('\x1b[38;5;252m│ \x1b[ma      \n\x1b[38;5;252m│ \x1b[mb      \n');
  });
});

// ─── WrapWriter ─────────────────────────────────────────────────────────────

describe('WrapWriter', () => {
  test('resets and restores the style around newlines', () => {
    const out = new StringWriter();
    const w = new WrapWriter(out);
    w.write('\x1b[38;5;252;1mab\ncd');
    w.close();
    expect(out.value).toBe('\x1b[38;5;252;1mab\x1b[m\n\x1b[1;38;5;252mcd\x1b[m');
  });

  test('resets and restores hyperlinks around newlines', () => {
    const out = new StringWriter();
    const w = new WrapWriter(out);
    w.write('\x1b]8;id=1;https://x.y\x07a\nb\x1b]8;;\x07');
    w.close();
    expect(out.value).toBe(
      '\x1b]8;id=1;https://x.y\x07a\x1b]8;;\x07\n\x1b]8;id=1;https://x.y\x07b\x1b]8;;\x07',
    );
  });

  test('writes nothing extra when no style is open', () => {
    const out = new StringWriter();
    const w = new WrapWriter(out);
    w.write('a\x1b[1mb\x1b[m\nc');
    w.close();
    expect(out.value).toBe('a\x1b[1mb\x1b[m\nc');
  });
});

// ─── Close ordering (upstream TestIndentWriterCloseOrder) ───────────────────

describe('writer close ordering', () => {
  test('closes the wrap writer before the downstream writer', () => {
    const events: string[] = [];
    const inner = new WrapWriter({ write: (s) => events.push(`write:${JSON.stringify(s)}`) });
    const sink: WriterSink = {
      write: (s) => inner.write(s),
      close: () => {
        events.push('close');
        inner.close();
      },
    };
    const iw = new IndentWriter(sink, 2);
    iw.write('\x1b[1mhello\n');
    iw.close();
    // The trailing reset flushes through the sink before the sink closes.
    const closeAt = events.indexOf('close');
    expect(closeAt).toBeGreaterThan(0);
    expect(events.slice(0, closeAt).join('')).toContain('\\u001b[m');
    expect(() => iw.close()).not.toThrow();
  });
});
