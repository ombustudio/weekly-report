import { describe, expect, it } from 'vitest';
import { globToRegExp, matchesAny, parseList } from '../src/util/globs.js';

describe('globToRegExp', () => {
  it('matches * and ? patterns, case-insensitively', () => {
    expect(globToRegExp('api-*').test('api-users')).toBe(true);
    expect(globToRegExp('api-*').test('API-Users')).toBe(true);
    expect(globToRegExp('api-*').test('web')).toBe(false);
    expect(globToRegExp('web').test('web')).toBe(true);
    expect(globToRegExp('w?b').test('web')).toBe(true);
    expect(globToRegExp('*').test('anything')).toBe(true);
  });

  it('escapes regex specials in repo names', () => {
    expect(globToRegExp('repo.name').test('repo.name')).toBe(true);
    expect(globToRegExp('repo.name').test('repoXname')).toBe(false);
    expect(globToRegExp('a+b').test('a+b')).toBe(true);
  });

  it('matches bot patterns like *[bot]', () => {
    expect(globToRegExp('*[bot]').test('dependabot[bot]')).toBe(true);
    expect(globToRegExp('*[bot]').test('octocat')).toBe(false);
  });
});

describe('matchesAny / parseList', () => {
  it('checks a name against multiple globs', () => {
    expect(matchesAny('api-users', ['web', 'api-*'])).toBe(true);
    expect(matchesAny('docs', ['web', 'api-*'])).toBe(false);
  });

  it('splits comma/newline lists and trims', () => {
    expect(parseList('a, b,\nc\n , ')).toEqual(['a', 'b', 'c']);
    expect(parseList('')).toEqual([]);
    expect(parseList(undefined)).toEqual([]);
  });
});
