# Examples

Run from the repository root with [Bun](https://bun.sh). The examples import
this checkout's `src/` directly and sibling ports by package name, as a user
would. The sample markdown is bundled and made up. Use a truecolor terminal.

| Example | What it shows | Run |
|---------|---------------|-----|
| `render.ts` | Renders a markdown file with one built-in style. Arguments: `[file.md] [style] [wrap]`, defaulting to `examples/sample.md dark 80`. Used for the README recordings. | `bun examples/render.ts examples/sample.md dracula` |
| `custom-style.ts` | Renders a document with a custom `StyleConfig` (orange `>>>` headings, green inline code). | `bun examples/custom-style.ts` |
| `sample.md`, `theme.md` | Short documents for the README recordings: headings, emphasis, a block quote, links, a code block, a table and tasks. | `bun examples/render.ts examples/theme.md light` |
| `side-by-side.ts` | Renders one markdown file in two built-in styles and places them side by side with `@oakoliver/lipgloss`. Arguments: `[file.md] [styleA] [styleB] [wrap]`, defaulting to `examples/doc.md dracula tokyo-night 64`. Best at 138 columns. | `bun examples/side-by-side.ts` |
| `doc.md` | Release notes for a made-up project (Tidepool, a Postgres job queue) with headings, a table, nested lists, task items, a blockquote, a rule and links. | `bun examples/side-by-side.ts examples/doc.md dracula tokyo-night` |
| `code.md` | TypeScript and Go code blocks showing this library's API, for syntax highlighting. | `bun examples/side-by-side.ts examples/code.md tokyo-night dark` |

Styles: `dark`, `light`, `dracula`, `tokyo-night`, `pink`, `ascii`, `notty`.

## Sibling versions

`side-by-side.ts` needs `@oakoliver/lipgloss` 1.1.0 or newer (it uses
`blend1D`); 1.1.2 is current. With an older version installed it exits with a
message saying so.

Until that version is on npm, run against a local lipgloss build by copying
it over the installed package (this leaves `package.json` and the lockfile
alone; `bun install` restores the npm version):

```sh
LIPGLOSS_DIR=../lipgloss                      # path to a lipgloss checkout
(cd "$LIPGLOSS_DIR" && bun install && bun run build)
rm -rf node_modules/@oakoliver/lipgloss && mkdir -p node_modules/@oakoliver/lipgloss
cp -R "$LIPGLOSS_DIR"/{package.json,dist,src} node_modules/@oakoliver/lipgloss/
bun examples/side-by-side.ts
```

To type-check the examples (needs the same lipgloss version):
`bunx tsc --noEmit -p examples`.
