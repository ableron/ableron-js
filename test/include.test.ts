import { Include } from '../src/include';

test('should set raw attributes in constructor', () => {
  // given
  const rawAttributes = new Map([['src', 'https://example.com']]);

  // expect
  expect(new Include(rawAttributes).getRawAttributes()).toEqual(rawAttributes);
});

test.each([
  [new Include(undefined, undefined), ''],
  [new Include(undefined, 'fallback'), 'fallback']
])('should set fallback content in constructor', (include: Include, expectedFallbackContent: string) => {
  expect(include.getFallbackContent()).toBe(expectedFallbackContent);
});

test('should set raw include tag in constructor', () => {
  // given
  const rawIncludeTag = '<ableron-include src="https://example.com"/>';

  // expect
  expect(new Include(undefined, undefined, rawIncludeTag).getRawIncludeTag()).toBe(rawIncludeTag);
});

test.each([
  [new Include(new Map()), 'da39a3e'],
  [new Include(new Map([['id', 'foo-bar']])), 'foo-bar'],
  [new Include(new Map([['id', 'FOO-bar%baz__/5']])), 'FOO-barbaz__5'],
  [new Include(new Map([['id', '//']])), 'da39a3e'],
  [new Include(new Map(), '', 'zzzzz'), 'a2b7cad'],
  [new Include(new Map(), '', 'zzzzzz'), '984ff6e']
])('should handle include id', (include: Include, expectedId: string) => {
  expect(include.getId()).toBe(expectedId);
});
