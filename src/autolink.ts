/**
 * Package autolink provides a function to detect and format GitHub links into
 * a more readable manner.
 *
 * Port of charm.land/glamour/v2/internal/autolink
 */

interface Pattern {
  pattern: RegExp;
  yield: (m: RegExpMatchArray) => string;
}

const patterns: Pattern[] = [
  {
    pattern: /^https?:\/\/github\.com\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/(issues?|pulls?|discussions?)\/([0-9]+)$/,
    yield: (m) => `${m[1]}/${m[2]}#${m[4]}`,
  },
  {
    pattern:
      /^https?:\/\/github\.com\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/(issues?|pulls?|discussions?)\/([0-9]+)#issuecomment-[0-9]+$/,
    yield: (m) => `${m[1]}/${m[2]}#${m[4]} (comment)`,
  },
  {
    pattern:
      /^https?:\/\/github\.com\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/pulls?\/([0-9]+)#discussion_r[0-9]+$/,
    yield: (m) => `${m[1]}/${m[2]}#${m[3]} (comment)`,
  },
  {
    pattern:
      /^https?:\/\/github\.com\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/pulls?\/([0-9]+)#pullrequestreview-[0-9]+$/,
    yield: (m) => `${m[1]}/${m[2]}#${m[3]} (review)`,
  },
  {
    pattern:
      /^https?:\/\/github\.com\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/discussions\/([0-9]+)#discussioncomment-[0-9]+$/,
    yield: (m) => `${m[1]}/${m[2]}#${m[3]} (comment)`,
  },
  {
    pattern:
      /^https?:\/\/github\.com\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/commit\/([A-Za-z0-9]{7,})(#.*)?$/,
    yield: (m) => `${m[1]}/${m[2]}@${m[3].slice(0, 7)}`,
  },
  {
    pattern:
      /^https?:\/\/github\.com\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/pulls?\/[0-9]+\/commits\/([A-Za-z0-9]{7,})(#.*)?$/,
    yield: (m) => `${m[1]}/${m[2]}@${m[3].slice(0, 7)}`,
  },
];

/**
 * Detect checks if the given URL matches any of the known patterns and
 * returns a human-readable formatted string if a match is found.
 */
export function detect(url: string): [string, boolean] {
  for (const p of patterns) {
    const m = url.match(p.pattern);
    if (m && m.length > 0) {
      return [p.yield(m), true];
    }
  }
  return ['', false];
}
