import { describe, expect, test } from 'bun:test';
import {
  stripAnsi,
  stringWidth,
  stripHTML,
  parseColorToSGR,
  buildSGR,
  renderText,
  formatTemplate,
  escapeReplacer,
  wordWrap,
  renderElement,
} from '../src/baseelement.js';

// ─── stripAnsi ──────────────────────────────────────────────────────────────

describe('stripAnsi', () => {
  test('removes SGR sequences', () => {
    expect(stripAnsi('\x1b[1mhello\x1b[0m')).toBe('hello');
  });

  test('removes complex SGR sequences', () => {
    expect(stripAnsi('\x1b[38;2;255;0;0mred\x1b[0m')).toBe('red');
  });

  test('returns plain text unchanged', () => {
    expect(stripAnsi('hello world')).toBe('hello world');
  });

  test('removes multiple sequences', () => {
    expect(stripAnsi('\x1b[1mbold\x1b[0m and \x1b[3mitalic\x1b[0m')).toBe('bold and italic');
  });

  test('handles empty string', () => {
    expect(stripAnsi('')).toBe('');
  });
});

// ─── stringWidth ────────────────────────────────────────────────────────────

describe('stringWidth', () => {
  test('returns correct width for ASCII text', () => {
    expect(stringWidth('hello')).toBe(5);
  });

  test('ignores ANSI escape sequences', () => {
    expect(stringWidth('\x1b[1mhello\x1b[0m')).toBe(5);
  });

  test('counts CJK characters as width 2', () => {
    // U+4F60 (你) and U+597D (好) are CJK characters
    expect(stringWidth('你好')).toBe(4);
  });

  test('handles mixed ASCII and CJK', () => {
    expect(stringWidth('hi你好')).toBe(6);
  });

  test('returns 0 for empty string', () => {
    expect(stringWidth('')).toBe(0);
  });

  test('ignores ANSI in CJK strings', () => {
    expect(stringWidth('\x1b[31m你好\x1b[0m')).toBe(4);
  });
});

// ─── stripHTML ──────────────────────────────────────────────────────────────

describe('stripHTML', () => {
  test('removes simple tags', () => {
    expect(stripHTML('<b>bold</b>')).toBe('bold');
  });

  test('removes self-closing tags', () => {
    expect(stripHTML('text<br/>more')).toBe('textmore');
  });

  test('removes tags with attributes', () => {
    expect(stripHTML('<a href="url">link</a>')).toBe('link');
  });

  test('leaves plain text unchanged', () => {
    expect(stripHTML('no tags here')).toBe('no tags here');
  });

  test('handles empty string', () => {
    expect(stripHTML('')).toBe('');
  });
});

// ─── parseColorToSGR ───────────────────────────────────────────────────────

describe('parseColorToSGR', () => {
  test('parses #RRGGBB as foreground', () => {
    expect(parseColorToSGR('#FF0000', false)).toBe('38;2;255;0;0');
  });

  test('parses #RRGGBB as background', () => {
    expect(parseColorToSGR('#00FF00', true)).toBe('48;2;0;255;0');
  });

  test('parses #RGB shorthand', () => {
    expect(parseColorToSGR('#F00', false)).toBe('38;2;255;0;0');
  });

  test('parses 256-color index as foreground', () => {
    expect(parseColorToSGR('196', false)).toBe('38;5;196');
  });

  test('parses 256-color index as background', () => {
    expect(parseColorToSGR('236', true)).toBe('48;5;236');
  });

  test('parses named color "red" as foreground', () => {
    expect(parseColorToSGR('red', false)).toBe('38;5;1');
  });

  test('parses named color "bright-cyan" as background', () => {
    expect(parseColorToSGR('bright-cyan', true)).toBe('48;5;14');
  });

  test('parses "0" as 256-color black', () => {
    expect(parseColorToSGR('0', false)).toBe('38;5;0');
  });

  test('parses "255" as 256-color max', () => {
    expect(parseColorToSGR('255', false)).toBe('38;5;255');
  });
});

// ─── buildSGR ───────────────────────────────────────────────────────────────

describe('buildSGR', () => {
  test('returns empty for no attributes', () => {
    const { open, close } = buildSGR({});
    expect(open).toBe('');
    expect(close).toBe('');
  });

  test('generates bold SGR', () => {
    const { open, close } = buildSGR({ bold: true });
    expect(open).toBe('\x1b[1m');
    expect(close).toBe('\x1b[0m');
  });

  test('generates italic SGR', () => {
    const { open } = buildSGR({ italic: true });
    expect(open).toBe('\x1b[3m');
  });

  test('generates underline SGR', () => {
    const { open } = buildSGR({ underline: true });
    expect(open).toBe('\x1b[4m');
  });

  test('generates faint SGR', () => {
    const { open } = buildSGR({ faint: true });
    expect(open).toBe('\x1b[2m');
  });

  test('generates blink SGR', () => {
    const { open } = buildSGR({ blink: true });
    expect(open).toBe('\x1b[5m');
  });

  test('generates inverse SGR', () => {
    const { open } = buildSGR({ inverse: true });
    expect(open).toBe('\x1b[7m');
  });

  test('generates conceal SGR', () => {
    const { open } = buildSGR({ conceal: true });
    expect(open).toBe('\x1b[8m');
  });

  test('generates crossed_out SGR', () => {
    const { open } = buildSGR({ crossed_out: true });
    expect(open).toBe('\x1b[9m');
  });

  test('generates foreground color SGR', () => {
    const { open } = buildSGR({ color: '#FF0000' });
    expect(open).toBe('\x1b[38;2;255;0;0m');
  });

  test('generates background color SGR', () => {
    const { open } = buildSGR({ background_color: '#00FF00' });
    expect(open).toBe('\x1b[48;2;0;255;0m');
  });

  test('combines multiple attributes', () => {
    const { open } = buildSGR({ bold: true, italic: true, color: 'red' });
    expect(open).toBe('\x1b[1;3;38;5;1m');
  });

  test('combines bold + underline + bg color', () => {
    const { open } = buildSGR({ bold: true, underline: true, background_color: '236' });
    expect(open).toBe('\x1b[1;4;48;5;236m');
  });
});

// ─── renderText ─────────────────────────────────────────────────────────────

describe('renderText', () => {
  test('returns empty for empty text', () => {
    expect(renderText('', { bold: true })).toBe('');
  });

  test('applies bold styling', () => {
    const result = renderText('hello', { bold: true });
    expect(result).toBe('\x1b[1mhello\x1b[0m');
  });

  test('applies uppercase transformation', () => {
    const result = renderText('hello', { upper: true });
    expect(result).toBe('HELLO');
  });

  test('applies lowercase transformation', () => {
    const result = renderText('HELLO', { lower: true });
    expect(result).toBe('hello');
  });

  test('applies title case transformation', () => {
    const result = renderText('hello world', { title: true });
    expect(result).toBe('Hello World');
  });

  test('applies case + styling together', () => {
    const result = renderText('hello', { upper: true, bold: true });
    expect(result).toBe('\x1b[1mHELLO\x1b[0m');
  });

  test('returns plain text with no style attributes', () => {
    expect(renderText('hello', {})).toBe('hello');
  });

  test('applies color styling', () => {
    const result = renderText('red', { color: '#FF0000' });
    expect(result).toBe('\x1b[38;2;255;0;0mred\x1b[0m');
  });
});

// ─── renderElement ──────────────────────────────────────────────────────────

describe('renderElement', () => {
  test('renders with block prefix and suffix', () => {
    const style = { block_prefix: '[', block_suffix: ']', bold: true };
    const result = renderElement('hello', '', '', {}, style);
    expect(stripAnsi(result)).toBe('[hello]');
  });

  test('renders with prefix and suffix', () => {
    const style = { prefix: '>', suffix: '<', italic: true };
    const result = renderElement('text', '', '', {}, style);
    const stripped = stripAnsi(result);
    expect(stripped).toBe('>text<');
  });

  test('renders with format template', () => {
    const style = { format: '{{Bold "{{.text}}"}}' };
    // The format template replaces {{.text}} first, then processes {{Bold ...}}
    // But in our simple implementation, the format is applied before renderText
    const result = renderElement('test', '', '', {}, style);
    // The format should produce something with Bold applied
    expect(stripAnsi(result)).toBe('test');
  });

  test('applies escape replacements', () => {
    const result = renderElement('hello\\*world', '', '', {}, {});
    expect(result).toBe('hello*world');
  });

  test('renders element prefix/suffix with parent style', () => {
    const parentStyle = { color: '#FF0000' };
    const result = renderElement('text', '(', ')', parentStyle, {});
    // prefix and suffix should use parent style
    expect(result).toContain('(');
    expect(result).toContain(')');
    expect(result).toContain('text');
  });
});

// ─── escapeReplacer ─────────────────────────────────────────────────────────

describe('escapeReplacer', () => {
  test('replaces backslash-escaped characters', () => {
    expect(escapeReplacer('\\*')).toBe('*');
    expect(escapeReplacer('\\_')).toBe('_');
    expect(escapeReplacer('\\`')).toBe('`');
  });

  test('replaces backslash-backslash', () => {
    expect(escapeReplacer('\\\\')).toBe('\\');
  });

  test('replaces multiple escapes', () => {
    expect(escapeReplacer('\\*bold\\* and \\_italic\\_')).toBe('*bold* and _italic_');
  });

  test('leaves unescaped text alone', () => {
    expect(escapeReplacer('hello world')).toBe('hello world');
  });

  test('replaces brackets', () => {
    expect(escapeReplacer('\\[link\\]')).toBe('[link]');
    expect(escapeReplacer('\\(paren\\)')).toBe('(paren)');
    expect(escapeReplacer('\\{brace\\}')).toBe('{brace}');
    expect(escapeReplacer('\\<angle\\>')).toBe('<angle>');
  });

  test('replaces misc escapes', () => {
    expect(escapeReplacer('\\#')).toBe('#');
    expect(escapeReplacer('\\+')).toBe('+');
    expect(escapeReplacer('\\-')).toBe('-');
    expect(escapeReplacer('\\.')).toBe('.');
    expect(escapeReplacer('\\!')).toBe('!');
    expect(escapeReplacer('\\|')).toBe('|');
  });
});

// ─── formatTemplate ─────────────────────────────────────────────────────────

describe('formatTemplate', () => {
  test('replaces {{.text}} with text', () => {
    expect(formatTemplate('{{.text}}', 'hello')).toBe('hello');
  });

  test('replaces {{.text}} in context', () => {
    expect(formatTemplate('prefix-{{.text}}-suffix', 'world')).toBe('prefix-world-suffix');
  });

  test('processes {{Bold "..."}}', () => {
    const result = formatTemplate('{{Bold "hello"}}', '');
    expect(result).toBe('\x1b[1mhello\x1b[0m');
  });

  test('processes {{Italic "..."}}', () => {
    const result = formatTemplate('{{Italic "text"}}', '');
    expect(result).toBe('\x1b[3mtext\x1b[0m');
  });

  test('processes {{Underline "..."}}', () => {
    const result = formatTemplate('{{Underline "text"}}', '');
    expect(result).toBe('\x1b[4mtext\x1b[0m');
  });

  test('processes {{CrossOut "..."}}', () => {
    const result = formatTemplate('{{CrossOut "text"}}', '');
    expect(result).toBe('\x1b[9mtext\x1b[0m');
  });

  test('processes {{Faint "..."}}', () => {
    const result = formatTemplate('{{Faint "text"}}', '');
    expect(result).toBe('\x1b[2mtext\x1b[0m');
  });

  test('processes {{Color "fg" "bg" "text"}}', () => {
    const result = formatTemplate('{{Color "#FF0000" "" "red"}}', '');
    expect(result).toBe('\x1b[38;2;255;0;0mred\x1b[0m');
  });

  test('processes {{Color}} with fg and bg', () => {
    const result = formatTemplate('{{Color "red" "#00FF00" "text"}}', '');
    expect(result).toBe('\x1b[38;5;1;48;2;0;255;0mtext\x1b[0m');
  });
});

// ─── wordWrap ───────────────────────────────────────────────────────────────

describe('wordWrap', () => {
  test('does not wrap short text', () => {
    expect(wordWrap('hello', 10)).toBe('hello');
  });

  test('wraps long text at width boundary', () => {
    const result = wordWrap('hello world foo', 5);
    const lines = result.split('\n');
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(stringWidth(line)).toBeLessThanOrEqual(5);
    }
  });

  test('preserves existing newlines', () => {
    const result = wordWrap('hi\nthere', 20);
    expect(result).toBe('hi\nthere');
  });

  test('handles width 0 (no wrapping)', () => {
    expect(wordWrap('hello world', 0)).toBe('hello world');
  });

  test('preserves ANSI codes across wraps', () => {
    const input = '\x1b[1mhello world\x1b[0m';
    const result = wordWrap(input, 5);
    // After wrapping, the bold should still be present
    expect(result).toContain('\x1b[1m');
  });

  test('wraps CJK text correctly', () => {
    // Each CJK char is width 2, so 3 chars = width 6
    const result = wordWrap('你好世界测试', 4);
    const lines = result.split('\n');
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(stringWidth(line)).toBeLessThanOrEqual(4);
    }
  });
});
