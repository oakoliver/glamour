import { describe, expect, test } from 'bun:test';
import {
  RenderContext,
  TermRenderer,
  newTermRenderer,
  parse,
  stripAnsi,
  withBaseURL,
  withChromaFormatter,
  withColorProfile,
  withEmoji,
  withHyperlinks,
  withInlineTableLinks,
  withStandardStyle,
  withStyles,
  withStylesFromJSONBytes,
  withTableWrap,
  withWordWrap,
} from '../src/index.js';
import { IndentWriter, type WriterSink } from '../src/writers.js';

describe('glamour v2.0.1 option surface', () => {
  test('loads style JSON from UTF-8 bytes', () => {
    const renderer = new TermRenderer(
      withStylesFromJSONBytes(Buffer.from('{"text":{"upper":true}}')),
      withColorProfile(0),
    );
    expect(renderer.render('hello')).toContain('HELLO');
  });

  test('buffers write/close/read in upstream writer order', () => {
    const renderer = newTermRenderer(withStandardStyle('ascii'));
    expect(renderer.write('# streamed')).toBe(10);
    renderer.close();
    const output = renderer.read();
    expect(output).toBeInstanceOf(Buffer);
    expect(output?.toString()).toContain('streamed');
    expect(renderer.read()).toBeNull();
  });

  test('resolves relative link destinations against WithBaseURL', () => {
    const output = new TermRenderer(
      withStandardStyle('ascii'),
      withHyperlinks(false),
      withBaseURL('https://example.com/docs/'),
    ).render('[guide](start)');
    expect(stripAnsi(output)).toContain('https://example.com/docs/start');
  });

  test('expands emoji only when WithEmoji is enabled', () => {
    const plain = new TermRenderer(withStandardStyle('ascii')).render(':smile:');
    const expanded = new TermRenderer(withStandardStyle('ascii'), withEmoji()).render(':smile:');
    expect(plain).toContain(':smile:');
    expect(expanded).toContain('😄');
  });

  test('honors no-color and ANSI-16 profiles', () => {
    const styles = { document: {}, paragraph: {}, text: { color: '#ff0000', bold: true } };
    const plain = new TermRenderer(withStyles(styles), withColorProfile(0)).render('red');
    const ansi16 = new TermRenderer(withStyles(styles), withColorProfile(1)).render('red');
    expect(plain).not.toContain('\x1b[');
    expect(ansi16).toContain('\x1b[1;91m');
  });

  test('uses configured Chroma terminal formatter', () => {
    const output = new TermRenderer(
      withStyles({
        document: {},
        code_block: {
          chroma: {
            text: { color: '#ffffff' },
            keyword: { color: '#ff0000', bold: true },
          },
        },
      }),
      withChromaFormatter('terminal16'),
    ).render('```js\nconst answer = 42;\n```');
    expect(output).toContain('\x1b[');
    expect(stripAnsi(output)).toContain('const answer = 42;');
  });
});

describe('GFM and definition-list parsing parity', () => {
  test('parses definition terms and descriptions', () => {
    const root = parse('Term\n: Definition');
    expect(root.children[0].kind).toBe('definition_list');
    expect(root.children[0].children.map((node) => node.kind)).toEqual([
      'definition_term',
      'definition_description',
    ]);
  });

  test('resolves full, collapsed, and shortcut reference links', () => {
    const root = parse('[full][id] [collapsed][] [shortcut]\n\n[id]: /one\n[collapsed]: /two\n[shortcut]: /three');
    const paragraph = root.children[0];
    const links = paragraph.children.filter((node) => node.kind === 'link');
    expect(links.map((node) => node.destination)).toEqual(['/one', '/two', '/three']);
  });

  test('parses GFM extended URL and email autolinks', () => {
    const root = parse('https://example.com and person@example.com');
    const autolinks = root.children[0].children.filter((node) => node.kind === 'auto_link');
    expect(autolinks.map((node) => node.destination)).toEqual([
      'https://example.com',
      'mailto:person@example.com',
    ]);
  });

  test('retains image alt text and strikethrough content as nested inline nodes', () => {
    const root = parse('![*alt* text](image.png) ~~**removed**~~');
    const children = root.children[0].children;
    const image = children.find((node) => node.kind === 'image');
    const strike = children.find((node) => node.kind === 'strikethrough');
    expect(image?.children.map((node) => node.kind)).toEqual(['emphasis', 'text']);
    expect(strike?.children[0].kind).toBe('emphasis');
  });
});

describe('table parity', () => {
  const markdown = '| Name | Link |\n| --- | --- |\n| Oak | https://github.com/charmbracelet/glamour/issues/42 |';

  test('renders numbered table footer links by default', () => {
    const output = stripAnsi(new TermRenderer(
      withStandardStyle('ascii'),
      withHyperlinks(false),
      withWordWrap(50),
    ).render(markdown));
    expect(output).toContain('charmbracelet/glamour#42[1]');
    expect(output).toContain('[1]: charmbracelet/glamour#42');
    expect(output).toMatch(/https:\/\/github[^\n]*…/);
    expect(output).not.toContain('https://github.com/charmbracelet/glamour/issues/42');
  });

  test('renders links inline when requested', () => {
    const output = stripAnsi(new TermRenderer(
      withStandardStyle('ascii'),
      withHyperlinks(false),
      withInlineTableLinks(true),
      withWordWrap(80),
    ).render(markdown));
    expect(output).not.toContain('[1]:');
    expect(output).toContain('https://github.com/charmbracelet/glamour/issues/42');
  });

  test('truncates overlong cells when table wrapping is disabled', () => {
    const output = stripAnsi(new TermRenderer(
      withStandardStyle('ascii'),
      withHyperlinks(false),
      withTableWrap(false),
      withInlineTableLinks(true),
      withWordWrap(24),
    ).render(markdown));
    expect(output).toContain('…');
  });
});

describe('writer close ordering regression', () => {
  test('flushes the outer writer before closing its downstream sink', () => {
    const events: string[] = [];
    const sink: WriterSink = {
      write(value) {
        events.push(`write:${value}`);
      },
      flush() {
        events.push('flush');
      },
      close() {
        events.push('close');
      },
    };
    const writer = new IndentWriter(sink, '> ');
    writer.write('styled');
    writer.close();
    expect(events).toEqual(['write:> styled', 'flush', 'close']);
  });
});

describe('reviewed v2.0.1 edge-case parity', () => {
  test('accepts only colon definition markers and emits each initial term', () => {
    expect(parse('Term\n~ not a definition').children[0].kind).toBe('paragraph');
    const list = parse('Term one\nTerm two\n: description').children[0];
    expect(list.children.filter((node) => node.kind === 'definition_term')).toHaveLength(2);
  });

  test('removes opener indentation from fenced bodies and accepts indented closers', () => {
    const block = parse('  ```js title=x\n  const x = 1\n   ```').children[0];
    expect(block.literal).toBe('const x = 1\n');
    expect(block.info).toBe('js title=x');
  });

  test('requires a valid GFM URL host and trims trailing punctuation', () => {
    const root = parse('https://localhost https://example.com/path).');
    const links = root.children[0].children.filter((node) => node.kind === 'auto_link');
    expect(links.map((node) => node.destination)).toEqual(['https://example.com/path']);
  });

  test('resolves blockquote references and decodes destination entities', () => {
    const root = parse('> [link][id]\n>\n> [id]: /a&amp;b');
    const quote = root.children[0];
    const link = quote.children[0].children.find((node) => node.kind === 'link');
    expect(link?.destination).toBe('/a&b');
  });

  test('does not extract reference-looking text from HTML blocks', () => {
    const root = parse('<div>\n[id]: /secret\n</div>\n\n[id]');
    const last = root.children[root.children.length - 1];
    expect(last.children.some((node) => node.kind === 'link')).toBe(false);
  });

  test('accepts terminal alias and emits only base ANSI colors for terminal8', () => {
    const styles = {
      document: {},
      code_block: { chroma: { text: { color: '#ffffff' } } },
    };
    expect(() => new TermRenderer(
      withStyles(styles),
      withChromaFormatter('terminal'),
    ).render('```js extra\nconst x = 1\n```')).not.toThrow();
    const terminal8 = new TermRenderer(
      withStyles(styles),
      withChromaFormatter('terminal8'),
    ).render('```js extra\nconst x = 1\n```');
    expect(terminal8).toContain('\x1b[37m');
    expect(terminal8).not.toMatch(/\x1b\[(?:38;2|38;5|9\d)/);
  });

  test('preserves nested table images and closes truncated OSC8 links', () => {
    const markdown = '| Cell |\n| --- |\n| [![*alt*](https://example.com/image.png)](https://example.com/target) |';
    const output = new TermRenderer(
      withStandardStyle('ascii'),
      withHyperlinks(true),
      withTableWrap(false),
      withWordWrap(24),
    ).render(markdown);
    const visible = stripAnsi(output);
    expect(visible).toContain('alt');
    expect(visible).toContain('…');
    expect(visible).not.toContain('https://example.com/image.png');
    expect(output).toContain('\x1b]8;;\x07');
    const truncated = new TermRenderer(
      withStandardStyle('ascii'),
      withHyperlinks(true),
      withInlineTableLinks(true),
      withTableWrap(false),
      withWordWrap(16),
    ).render('| URL |\n| --- |\n| https://example.com/very/long/path |');
    expect(truncated).toMatch(/…\x1b]8;;\x07/);
  });

  test('close appends to unread output and private-use text survives wrapping', () => {
    const renderer = new TermRenderer(withStandardStyle('ascii'), withColorProfile(0));
    renderer.write('first');
    renderer.close();
    const prefix = new Uint8Array(2);
    renderer.read(prefix);
    renderer.write('second');
    renderer.close();
    expect(renderer.read()?.toString()).toContain('second');
    expect(renderer.render(`before \uE000 after`)).toContain('\uE000');
  });
  test('extracts list-contained references but not references inside HTML across blanks', () => {
    const list = parse('- [link][id]\n    [id]: /inside-list');
    const paragraph = list.children[0].children[0].children
      .find((node) => node.kind === 'paragraph');
    const listLink = paragraph?.children.find((node) => node.kind === 'link');
    expect(listLink?.destination).toBe('/inside-list');

    const html = parse('<pre>\n\n[id]: /inside-html\n</pre>\n\n[id]');
    const last = html.children[html.children.length - 1];
    expect(last.children.some((node) => node.kind === 'link')).toBe(false);
  });

  test('uses the image domain for nested empty-alt table footer images', () => {
    const markdown = '| Cell |\n| --- |\n| [![](https://images.example.com/a.png)](https://example.com/target) |';
    const output = stripAnsi(new TermRenderer(
      withStandardStyle('ascii'),
      withHyperlinks(false),
      withWordWrap(50),
    ).render(markdown));
    expect(output).toContain('images.example.com');
    expect(output).toContain('…');
  });

  test('protects only the exact footer occurrence of a repeated URL', () => {
    const url = 'https://example.com/a/very/long/destination';
    const markdown = `| URL |\n| --- |\n| ${url} |\n\n${url}`;
    const output = stripAnsi(new TermRenderer(
      withStandardStyle('ascii'),
      withHyperlinks(false),
      withWordWrap(24),
    ).render(markdown));
    expect(output.split(url)).toHaveLength(1);
    expect(output).not.toContain('\0glamour:');
  });

  test('does not let HTML inside a fence hide later references', () => {
    const root = parse('```\n<div>\n```\n[id]: /outside\n\n[link][id]');
    const paragraph = root.children[root.children.length - 1];
    expect(paragraph.children.find((node) => node.kind === 'link')?.destination).toBe('/outside');
  });

  test('removes reference-only list items without leaving an orphan marker', () => {
    const root = parse('- [id]: /inside\n\n[link][id]');
    const list = root.children.find((node) => node.kind === 'list');
    const paragraph = root.children.find((node) => node.kind === 'paragraph');
    expect(list?.children).toHaveLength(0);
    expect(paragraph?.children.find((node) => node.kind === 'link')?.destination).toBe('/inside');
  });

  test('decodes highlighted and sanitized entities exactly once', () => {
    const highlighted = stripAnsi(new TermRenderer(
      withStyles({
        document: {},
        code_block: { chroma: { text: { color: '#ffffff' } } },
      }),
      withColorProfile(0),
    ).render('```text\n&amp;quot; &amp;#x27;\n```'));
    expect(highlighted).toContain('&amp;quot; &amp;#x27;');
    expect(highlighted).not.toContain('" \'');

    const context = new RenderContext({
      styles: {},
      wordWrap: 80,
      colorProfile: 0,
      hyperlinks: false,
      preserveNewLines: false,
    });
    expect(context.sanitizeHTML('&amp;lt; &amp;quot;', false)).toBe('&lt; &quot;');
  });

  test('does not emit a reset-only highlighted trailing line', () => {
    const output = new TermRenderer(
      withStyles({
        document: {},
        code_block: { chroma: { text: { color: '#ffffff' } } },
      }),
    ).render('```text\nline\n```');
    expect(output).not.toMatch(/\n\x1b\[0m(?:\n|$)/);
  });

  test('applies raw, block, and void HTML termination rules to references', () => {
    const block = parse('<div>\n\n[id]: /after-block\n\n[block][id]');
    const blockLink = block.children[block.children.length - 1].children
      .find((node) => node.kind === 'link');
    expect(blockLink?.destination).toBe('/after-block');

    const voidRoot = parse('<hr>\n[id]: /inside-void-block\n\n[void][id]');
    const voidNode = voidRoot.children[voidRoot.children.length - 1];
    expect(voidNode.children.some((node) => node.kind === 'link')).toBe(false);

    const closing = parse('</div>\n[id]: /inside-closing-block\n\n[close][id]');
    expect(closing.children[0].kind).toBe('html_block');
    const closingNode = closing.children[closing.children.length - 1];
    expect(closingNode.children.some((node) => node.kind === 'link')).toBe(false);
  });

  test('recognizes raw script/style/textarea blocks through their closing tags', () => {
    for (const tag of ['script', 'style', 'textarea']) {
      const markdown = `<${tag}>\n\n[id]: /hidden\n</${tag}>\n\n[x][id]`;
      const root = parse(markdown);
      expect(root.children[0].kind).toBe('html_block');
      const last = root.children[root.children.length - 1];
      expect(last.children.some((node) => node.kind === 'link')).toBe(false);
      const output = stripAnsi(new TermRenderer(
        withStandardStyle('ascii'),
        withHyperlinks(false),
      ).render(markdown));
      expect(output).toContain('[x][id]');
    }
  });

  test('keeps literal fences inside active HTML without corrupting reference state', () => {
    for (const tag of ['div', 'pre']) {
      const markdown = `<${tag}>\n\`\`\`\n</${tag}>\n\n[id]: /after-html\n\n[x][id]`;
      const root = parse(markdown);
      const last = root.children[root.children.length - 1];
      expect(last.children.find((node) => node.kind === 'link')?.destination).toBe('/after-html');
    }
  });
});
