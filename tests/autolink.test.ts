/**
 * Tests for the autolink module.
 * Port of charm.land/glamour/v2/internal/autolink tests.
 */
import { describe, test, expect } from 'bun:test';
import { detect } from '../src/autolink';

describe('autolink', () => {
  // Port of TestDetect from autolink_test.go
  const tests: { url: string; expected: string }[] = [
    // Issue/PR/Discussion URLs
    { url: 'https://github.com/owner/repo/issue/123', expected: 'owner/repo#123' },
    { url: 'https://github.com/owner/repo/issues/123', expected: 'owner/repo#123' },
    { url: 'https://github.com/owner/repo/pull/123', expected: 'owner/repo#123' },
    { url: 'https://github.com/owner/repo/pulls/123', expected: 'owner/repo#123' },
    { url: 'https://github.com/owner/repo/discussions/123', expected: 'owner/repo#123' },

    // Issue comments
    {
      url: 'https://github.com/owner/repo/issue/123#issuecomment-456',
      expected: 'owner/repo#123 (comment)',
    },
    {
      url: 'https://github.com/owner/repo/issues/123#issuecomment-456',
      expected: 'owner/repo#123 (comment)',
    },
    {
      url: 'https://github.com/owner/repo/pull/123#issuecomment-456',
      expected: 'owner/repo#123 (comment)',
    },
    {
      url: 'https://github.com/owner/repo/pulls/123#issuecomment-456',
      expected: 'owner/repo#123 (comment)',
    },

    // PR discussion comments
    {
      url: 'https://github.com/owner/repo/pull/123#discussion_r456',
      expected: 'owner/repo#123 (comment)',
    },
    {
      url: 'https://github.com/owner/repo/pulls/123#discussion_r456',
      expected: 'owner/repo#123 (comment)',
    },

    // PR reviews
    {
      url: 'https://github.com/owner/repo/pull/123#pullrequestreview-456',
      expected: 'owner/repo#123 (review)',
    },
    {
      url: 'https://github.com/owner/repo/pulls/123#pullrequestreview-456',
      expected: 'owner/repo#123 (review)',
    },

    // Discussion comments
    {
      url: 'https://github.com/owner/repo/discussions/123#discussioncomment-456',
      expected: 'owner/repo#123 (comment)',
    },

    // Commit URLs
    {
      url: 'https://github.com/owner/repo/commit/abcdefghijklmnopqrsxyz',
      expected: 'owner/repo@abcdefg',
    },

    // Commits in PRs
    {
      url: 'https://github.com/owner/repo/pull/123/commits/abcdefghijklmnopqrsxyz',
      expected: 'owner/repo@abcdefg',
    },
    {
      url: 'https://github.com/owner/repo/pulls/123/commits/abcdefghijklmnopqrsxyz',
      expected: 'owner/repo@abcdefg',
    },

    // Commit with diff fragment
    {
      url: 'https://github.com/owner/repo/commit/abcdefghijklmnopqrsxyz#diff-123',
      expected: 'owner/repo@abcdefg',
    },
    {
      url: 'https://github.com/owner/repo/pull/123/commits/abcdefghijklmnopqrsxyz#diff-123',
      expected: 'owner/repo@abcdefg',
    },
    {
      url: 'https://github.com/owner/repo/pulls/123/commits/abcdefghijklmnopqrsxyz#diff-123',
      expected: 'owner/repo@abcdefg',
    },
  ];

  for (const { url, expected } of tests) {
    test(`detect ${url}`, () => {
      const [result, ok] = detect(url);
      expect(ok).toBe(true);
      expect(result).toBe(expected);
    });
  }

  // Additional tests for non-matching URLs
  test('non-GitHub URL returns false', () => {
    const [, ok] = detect('https://example.com/path');
    expect(ok).toBe(false);
  });

  test('malformed GitHub URL returns false', () => {
    const [, ok] = detect('https://github.com/owner');
    expect(ok).toBe(false);
  });

  test('GitHub root URL returns false', () => {
    const [, ok] = detect('https://github.com');
    expect(ok).toBe(false);
  });

  test('GitHub repo URL without issue/PR returns false', () => {
    const [, ok] = detect('https://github.com/owner/repo');
    expect(ok).toBe(false);
  });

  test('HTTP URLs work same as HTTPS', () => {
    const [result, ok] = detect('http://github.com/owner/repo/issues/123');
    expect(ok).toBe(true);
    expect(result).toBe('owner/repo#123');
  });
});
