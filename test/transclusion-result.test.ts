import { TransclusionResult } from '../src';
import { Include } from '../src/include';
import { Fragment } from '../src/fragment';

test('should return reasonable defaults', () => {
  // given
  const transclusionResult = new TransclusionResult('content');

  // expect
  expect(transclusionResult.getContent()).toBe('content');
  expect(transclusionResult.getContentExpirationTime()).toBeUndefined();
  expect(transclusionResult.getHasPrimaryInclude()).toBe(false);
  expect(transclusionResult.getStatusCodeOverride()).toBeUndefined();
  expect(transclusionResult.getResponseHeadersToPass()).toEqual(new Headers());
  expect(transclusionResult.getProcessedIncludesCount()).toBe(0);
  expect(transclusionResult.getProcessingTimeMillis()).toBe(0);
});

test('should set processing time', () => {
  // given
  const transclusionResult = new TransclusionResult('content');

  // when
  transclusionResult.setProcessingTimeMillis(111);

  // then
  expect(transclusionResult.getProcessingTimeMillis()).toBe(111);
});

test('should handle resolved include correctly', () => {
  // given
  const transclusionResult = new TransclusionResult('content: <include>');
  const include = new Include(new Map([['primary', '']]), 'fallback', '<include>');
  const fragment = new Fragment(404, 'not found', undefined, new Date(0), new Headers([['X-Test', 'Foo']]));

  // when
  transclusionResult.addResolvedInclude(include, fragment, 0);

  // then
  expect(transclusionResult.getContent()).toBe('content: not found');
  expect(transclusionResult.getContentExpirationTime()).toEqual(new Date(0));
  expect(transclusionResult.getHasPrimaryInclude()).toBe(true);
  expect(transclusionResult.getStatusCodeOverride()).toBe(404);
  expect(transclusionResult.getResponseHeadersToPass()).toEqual(new Headers([['X-Test', 'Foo']]));
  expect(transclusionResult.getProcessedIncludesCount()).toBe(1);
  expect(transclusionResult.getProcessingTimeMillis()).toBe(0);
});

test.each([
  [new Date(0), undefined, 'no-store'],
  [new Date(new Date().getTime() - 5000), undefined, 'no-store'],
  [new Date(), undefined, 'no-store'],
  [new Date(new Date().getTime() + 300000), undefined, 'no-store'],
  [new Date(0), 0, 'no-store'],
  [new Date(new Date().getTime() - 5000), 0, 'no-store'],
  [new Date(), 0, 'no-store'],
  [new Date(new Date().getTime() + 300000), 0, 'no-store'],
  [new Date(0), 120, 'no-store'],
  [new Date(new Date().getTime() - 5000), 120, 'no-store'],
  [new Date(), 120, 'no-store'],
  [new Date(new Date().getTime() + 300000), 120, 'max-age=120'],
  [new Date(new Date().getTime() + 300000), 300, 'max-age=300'],
  [new Date(new Date().getTime() + 300000), 600, 'max-age=300']
])(
  'should calculate cache control header value',
  (fragmentExpirationTime: Date, pageMaxAge: number | undefined, expectedCacheControlHeaderValue: string) => {
    // given
    const transclusionResult = new TransclusionResult('content');
    transclusionResult.addResolvedInclude(new Include(), new Fragment(200, '', undefined, fragmentExpirationTime), 0);

    // expect
    expect(transclusionResult.calculateCacheControlHeaderValue(pageMaxAge)).toBe(expectedCacheControlHeaderValue);
  }
);

test.each([
  [new Date(0), new Headers(), 'no-store'],
  [new Date(new Date().getTime() - 5000), new Headers(), 'no-store'],
  [new Date(), new Headers(), 'no-store'],
  [new Date(new Date().getTime() + 300000), new Headers(), 'no-store'],
  [new Date(0), new Headers([['Cache-Control', 'no-cache']]), 'no-store'],
  [new Date(new Date().getTime() - 5000), new Headers([['Cache-Control', 'no-cache']]), 'no-store'],
  [new Date(), new Headers([['Cache-Control', 'no-cache']]), 'no-store'],
  [new Date(new Date().getTime() + 300000), new Headers([['Cache-Control', 'no-cache']]), 'no-store'],
  [new Date(0), new Headers([['Cache-Control', 'max-age=0']]), 'no-store'],
  [new Date(new Date().getTime() - 5000), new Headers([['Cache-Control', 'max-age=0']]), 'no-store'],
  [new Date(), new Headers([['Cache-Control', 'max-age=0']]), 'no-store'],
  [new Date(new Date().getTime() + 300000), new Headers([['Cache-Control', 'max-age=0']]), 'no-store'],
  [new Date(0), new Headers([['Cache-Control', 'max-age=120']]), 'no-store'],
  [new Date(new Date().getTime() - 5000), new Headers([['Cache-Control', 'max-age=120']]), 'no-store'],
  [new Date(), new Headers([['Cache-Control', 'max-age=120']]), 'no-store'],
  [new Date(new Date().getTime() + 300000), new Headers([['Cache-Control', 'max-age=120']]), 'max-age=120'],
  [new Date(new Date().getTime() + 300000), new Headers([['Cache-Control', 'max-age=300']]), 'max-age=300'],
  [new Date(new Date().getTime() + 300000), new Headers([['Cache-Control', 'max-age=600']]), 'max-age=300']
])(
  'should calculate cache control header value based on given response headers',
  (fragmentExpirationTime: Date, responseHeaders: Headers, expectedCacheControlHeaderValue: string) => {
    // given
    const transclusionResult = new TransclusionResult('content');
    transclusionResult.addResolvedInclude(new Include(), new Fragment(200, '', undefined, fragmentExpirationTime), 0);

    // expect
    expect(transclusionResult.calculateCacheControlHeaderValueByResponseHeaders(responseHeaders)).toBe(
      expectedCacheControlHeaderValue
    );
  }
);

test('should handle missing content expiration time when calculating cache control header value', () => {
  expect(new TransclusionResult('').calculateCacheControlHeaderValueByResponseHeaders(new Headers())).toBe('no-store');
});

test('should not append stats to content by default', () => {
  expect(new TransclusionResult('content').getContent()).toBe('content');
});

test('should append stats to content - zero includes', () => {
  expect(new TransclusionResult('content', true).getContent()).toBe(
    'content\n<!-- Ableron stats:\nProcessed 0 include(s) in 0ms\n-->'
  );
});

test('should append stats to content - more than zero includes', () => {
  // given
  const transclusionResult = new TransclusionResult('', true);

  // when
  transclusionResult.addResolvedInclude(new Include(undefined, undefined, 'include#1'), new Fragment(200, ''), 0);
  transclusionResult.addResolvedInclude(
    new Include(undefined, undefined, 'include#2'),
    new Fragment(404, 'not found', 'http://...'),
    233
  );
  transclusionResult.addResolvedInclude(
    new Include(undefined, 'fallback', 'include#3'),
    new Fragment(404, 'not found', 'http://...', new Date(2524608000000)),
    999
  );

  // then
  expect(transclusionResult.getContent()).toBe(
    '\n<!-- Ableron stats:\n' +
      'Processed 3 include(s) in 0ms\n' +
      'Resolved include ceef048 with fallback content in 0ms\n' +
      'Resolved include a57865f with uncacheable remote fragment in 233ms\n' +
      'Resolved include 184d860 with remote fragment with cache expiration time 2050-01-01T00:00:00Z in 999ms\n' +
      '-->'
  );
});

test('should append stats for primary include', () => {
  // given
  const transclusionResult = new TransclusionResult('', true);

  // when
  transclusionResult.addResolvedInclude(
    new Include(new Map([['primary', '']]), undefined, 'include#1'),
    new Fragment(200, ''),
    0
  );

  // then
  expect(transclusionResult.getContent()).toBe(
    '\n<!-- Ableron stats:\n' +
      'Processed 1 include(s) in 0ms\n' +
      'Primary include with status code 200\n' +
      'Resolved include ceef048 with fallback content in 0ms\n' +
      '-->'
  );
});

test('should append stats for primary include - multiple primary includes', () => {
  // given
  const transclusionResult = new TransclusionResult('', true);

  // when
  transclusionResult.addResolvedInclude(
    new Include(new Map([['primary', '']]), undefined, 'include#1'),
    new Fragment(200, ''),
    0
  );
  transclusionResult.addResolvedInclude(
    new Include(new Map([['primary', '']]), undefined, 'include#2'),
    new Fragment(200, ''),
    33
  );

  // then
  expect(transclusionResult.getContent()).toBe(
    '\n<!-- Ableron stats:\n' +
      'Processed 2 include(s) in 0ms\n' +
      'Primary include with status code 200\n' +
      'Resolved include ceef048 with fallback content in 0ms\n' +
      'Ignoring primary include with status code 200 because there is already another primary include\n' +
      'Resolved include a57865f with fallback content in 33ms\n' +
      '-->'
  );
});
