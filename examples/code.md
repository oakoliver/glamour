## One API, two languages

The TypeScript port mirrors the Go functional options:

```ts
import {
  TermRenderer, withStandardStyle, withWordWrap,
} from "@oakoliver/glamour";

const r = new TermRenderer(
  withStandardStyle("tokyo-night"),
  withWordWrap(64),
);
const readme = await Bun.file("README.md").text();
const out: string = r.render(readme);
process.stdout.write(out);
```

The upstream Go it tracks, line for line:

```go
r, err := glamour.NewTermRenderer(
    glamour.WithStandardStyle("tokyo-night"),
    glamour.WithWordWrap(64),
)
if err != nil {
    log.Fatal(err)
}
out, _ := r.Render(string(readme))
fmt.Print(out)
```

Rendered by `@oakoliver/glamour`, highlighted via *chroma-style* themes.
