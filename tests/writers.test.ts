import { describe, expect, test } from 'bun:test';
import { MarginWriter, PaddingWriter, IndentWriter } from '../src/writers.js';
import { stringWidth } from '../src/baseelement.js';

// ─── MarginWriter ───────────────────────────────────────────────────────────

describe('MarginWriter', () => {
  test('adds left margin to single line', () => {
    const w = new MarginWriter(4);
    w.write('hello');
    expect(w.flush()).toBe('    hello');
  });

  test('adds left margin to each line', () => {
    const w = new MarginWriter(2);
    w.write('line1\nline2\nline3');
    expect(w.flush()).toBe('  line1\n  line2\n  line3');
  });

  test('handles empty content', () => {
    const w = new MarginWriter(4);
    w.write('');
    expect(w.flush()).toBe('    ');
  });

  test('handles zero margin', () => {
    const w = new MarginWriter(0);
    w.write('hello');
    expect(w.flush()).toBe('hello');
  });

  test('handles empty lines in content', () => {
    const w = new MarginWriter(3);
    w.write('a\n\nb');
    expect(w.flush()).toBe('   a\n   \n   b');
  });

  test('handles multiple writes', () => {
    const w = new MarginWriter(2);
    w.write('hello ');
    w.write('world');
    expect(w.flush()).toBe('  hello world');
  });
});

// ─── PaddingWriter ──────────────────────────────────────────────────────────

describe('PaddingWriter', () => {
  test('pads single line to width', () => {
    const w = new PaddingWriter(10);
    w.write('hello');
    const result = w.flush();
    expect(stringWidth(result)).toBe(10);
    expect(result).toBe('hello     ');
  });

  test('pads each line to width', () => {
    const w = new PaddingWriter(10);
    w.write('hi\nthere');
    const result = w.flush();
    const lines = result.split('\n');
    expect(lines.length).toBe(2);
    expect(stringWidth(lines[0])).toBe(10);
    expect(stringWidth(lines[1])).toBe(10);
  });

  test('does not pad lines that are already at width', () => {
    const w = new PaddingWriter(5);
    w.write('12345');
    expect(w.flush()).toBe('12345');
  });

  test('does not pad lines longer than width', () => {
    const w = new PaddingWriter(3);
    w.write('hello');
    expect(w.flush()).toBe('hello');
  });

  test('applies pad style to padding spaces', () => {
    const padStyle = '\x1b[48;5;236m';
    const w = new PaddingWriter(10, padStyle);
    w.write('hi');
    const result = w.flush();
    expect(result).toContain(padStyle);
    expect(result).toContain('\x1b[0m');
  });

  test('handles zero width', () => {
    const w = new PaddingWriter(0);
    w.write('hello');
    expect(w.flush()).toBe('hello');
  });

  test('handles empty content', () => {
    const w = new PaddingWriter(5);
    w.write('');
    const result = w.flush();
    expect(stringWidth(result)).toBe(5);
  });

  test('handles multiple lines with different lengths', () => {
    const w = new PaddingWriter(8);
    w.write('ab\nabcdef\nab');
    const result = w.flush();
    const lines = result.split('\n');
    expect(stringWidth(lines[0])).toBe(8);
    expect(stringWidth(lines[1])).toBe(8);
    expect(stringWidth(lines[2])).toBe(8);
  });
});

// ─── IndentWriter ───────────────────────────────────────────────────────────

describe('IndentWriter', () => {
  test('prepends indent token to single line', () => {
    const w = new IndentWriter('  ');
    w.write('hello');
    expect(w.flush()).toBe('  hello');
  });

  test('prepends indent token to each line', () => {
    const w = new IndentWriter('│ ');
    w.write('line1\nline2');
    expect(w.flush()).toBe('│ line1\n│ line2');
  });

  test('handles empty lines', () => {
    const w = new IndentWriter('> ');
    w.write('a\n\nb');
    expect(w.flush()).toBe('> a\n> \n> b');
  });

  test('handles count > 1', () => {
    const w = new IndentWriter('  ', 3);
    w.write('hello');
    expect(w.flush()).toBe('      hello');
  });

  test('handles empty content', () => {
    const w = new IndentWriter('> ');
    w.write('');
    expect(w.flush()).toBe('> ');
  });

  test('multiple writes accumulate', () => {
    const w = new IndentWriter('- ');
    w.write('hello ');
    w.write('world');
    expect(w.flush()).toBe('- hello world');
  });
});

// ─── Nested Writers ─────────────────────────────────────────────────────────

describe('Nested writers', () => {
  test('IndentWriter wrapping PaddingWriter', () => {
    // First pad content, then indent
    const pad = new PaddingWriter(10);
    pad.write('hello');
    const padded = pad.flush();

    const indent = new IndentWriter('│ ');
    indent.write(padded);
    const result = indent.flush();

    expect(result).toBe('│ hello     ');
  });

  test('MarginWriter wrapping IndentWriter', () => {
    // First indent, then add margin
    const indent = new IndentWriter('> ');
    indent.write('text');
    const indented = indent.flush();

    const margin = new MarginWriter(4);
    margin.write(indented);
    const result = margin.flush();

    expect(result).toBe('    > text');
  });

  test('MarginWriter wrapping IndentWriter wrapping PaddingWriter (multi-line)', () => {
    // Inner to outer: pad → indent → margin
    const pad = new PaddingWriter(8);
    pad.write('hi\nbye');
    const padded = pad.flush();

    const indent = new IndentWriter('│ ');
    indent.write(padded);
    const indented = indent.flush();

    const margin = new MarginWriter(2);
    margin.write(indented);
    const result = margin.flush();

    const lines = result.split('\n');
    expect(lines.length).toBe(2);
    // Each line: 2 margin + "│ " (2) + padded to 8 = 12
    expect(lines[0]).toBe('  │ hi      ');
    expect(lines[1]).toBe('  │ bye     ');
  });

  test('all three with empty lines', () => {
    const pad = new PaddingWriter(6);
    pad.write('a\n\nb');
    const padded = pad.flush();

    const indent = new IndentWriter('| ');
    indent.write(padded);
    const indented = indent.flush();

    const margin = new MarginWriter(1);
    margin.write(indented);
    const result = margin.flush();

    const lines = result.split('\n');
    expect(lines.length).toBe(3);
    // Line 1: " | a     " (1 margin + "| " + "a" + 5 spaces)
    expect(lines[0]).toBe(' | a     ');
    // Line 2: " | " + 6 spaces (empty line padded)
    expect(lines[1]).toBe(' |       ');
    // Line 3: " | b     " (1 margin + "| " + "b" + 5 spaces)
    expect(lines[2]).toBe(' | b     ');
  });
});
