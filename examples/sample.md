# Glamour

Stylesheet-based **markdown** rendering for your *terminal* — now in TypeScript.

> Write your styles once, as JSON, and every markdown document in your
> terminal follows them.

## Features

- Headings, **bold**, *italics*, ~~strikethrough~~ and `inline code`
- [Links](https://github.com/oakoliver/glamour) and task lists
- Tables and syntax-highlighted code

## Code

```ts
import { renderWithStyle } from '@oakoliver/glamour';

const out = renderWithStyle('# Hello', 'dark');
console.log(out);
```

## Table

| Theme       | Background | Best for          |
| ----------- | ---------- | ----------------- |
| dark        | dark       | most terminals    |
| light       | light      | light terminals   |
| dracula     | dark       | Dracula fans      |
| tokyo-night | dark       | Tokyo Night fans  |

## Tasks

- [x] Parse GFM
- [x] Render ANSI
- [ ] Take over the world
