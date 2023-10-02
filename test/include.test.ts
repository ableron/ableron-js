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

test.each([
  [new Include(new Map()), undefined],
  [new Include(new Map([['src', 'https://example.com']])), 'https://example.com']
])('should set src attribute in constructor', (include: Include, expectedSrc?: string) => {
  expect(include.getSrc()).toBe(expectedSrc);
});

test.each([
  [new Include(new Map()), undefined],
  [new Include(new Map([['src-timeout-millis', '2000']])), 2000],
  [new Include(new Map([['src-timeout-millis', '2s']])), undefined]
])('should set src timeout attribute in constructor', (include: Include, expectedSrcTimeout?: number) => {
  expect(include.getSrcTimeoutMillis()).toBe(expectedSrcTimeout);
});

test.each([
  [new Include(new Map()), undefined],
  [new Include(new Map([['fallback-src', 'https://example.com']])), 'https://example.com']
])('should set fallback-src attribute in constructor', (include: Include, expectedFallbackSrc?: string) => {
  expect(include.getFallbackSrc()).toBe(expectedFallbackSrc);
});

test.each([
  [new Include(new Map()), undefined],
  [new Include(new Map([['fallback-src-timeout-millis', '2000']])), 2000],
  [new Include(new Map([['fallback-src-timeout-millis', '2s']])), undefined]
])(
  'should set fallback-src timeout attribute in constructor',
  (include: Include, expectedFallbackSrcTimeout?: number) => {
    expect(include.getFallbackSrcTimeoutMillis()).toBe(expectedFallbackSrcTimeout);
  }
);

test.each([
  [new Include(new Map()), false],
  [new Include(new Map([['primary', '']])), true],
  [new Include(new Map([['primary', 'primary']])), true],
  [new Include(new Map([['primary', 'PRIMARY']])), true],
  [new Include(new Map([['primary', 'nope']])), false]
])('should set primary attribute in constructor', (include: Include, expectedPrimary: boolean) => {
  expect(include.isPrimary()).toBe(expectedPrimary);
});
