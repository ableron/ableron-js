import { describe, expect, it } from 'vitest';
import { AbleronConfig, TransclusionResult } from '../src/index.js';
import Include from '../src/include.js';
import Fragment from '../src/fragment.js';
import Fastify, { FastifyInstance } from 'fastify';
import TransclusionProcessor from '../src/transclusion-processor';
import { NoOpLogger } from '../src/logger';
import CacheStats from '../src/cache-stats';

describe('TransclusionResult', () => {
  it('should return reasonable defaults', () => {
    // given
    const transclusionResult = new TransclusionResult('content', new CacheStats());

    // expect
    expect(transclusionResult.getContent()).toBe('content');
    expect(transclusionResult.getContentExpirationTime()).toBeUndefined();
    expect(transclusionResult.getHasPrimaryInclude()).toBe(false);
    expect(transclusionResult.getStatusCodeOverride()).toBeUndefined();
    expect(transclusionResult.getResponseHeadersToPass()).toEqual(new Headers());
    expect(transclusionResult.getProcessedIncludesCount()).toBe(0);
    expect(transclusionResult.getProcessingTimeMillis()).toBe(0);
  });

  it('should set processing time', () => {
    // given
    const transclusionResult = new TransclusionResult('content', new CacheStats());

    // when
    transclusionResult.setProcessingTimeMillis(111);

    // then
    expect(transclusionResult.getProcessingTimeMillis()).toBe(111);
  });

  it('should handle resolved include correctly', () => {
    // given
    const transclusionResult = new TransclusionResult('content: <include>', new CacheStats());

    // when
    transclusionResult.addResolvedInclude(
      new Include('<include>', new Map([['primary', '']]), 'fallback').resolveWith(
        new Fragment(404, 'not found', undefined, new Date(0), new Headers([['X-Test', 'Foo']]))
      )
    );

    // then
    expect(transclusionResult.getContent()).toBe('content: not found');
    expect(transclusionResult.getContentExpirationTime()).toEqual(new Date(0));
    expect(transclusionResult.getHasPrimaryInclude()).toBe(true);
    expect(transclusionResult.getStatusCodeOverride()).toBe(404);
    expect(transclusionResult.getResponseHeadersToPass()).toEqual(new Headers([['X-Test', 'Foo']]));
    expect(transclusionResult.getProcessedIncludesCount()).toBe(1);
    expect(transclusionResult.getProcessingTimeMillis()).toBe(0);
  });

  it.each([
    [new Date(0), undefined, 'no-store'],
    [new Date(Date.now() - 5000), undefined, 'no-store'],
    [new Date(), undefined, 'no-store'],
    [new Date(Date.now() + 300000), undefined, 'no-store'],
    [new Date(0), 0, 'no-store'],
    [new Date(Date.now() - 5000), 0, 'no-store'],
    [new Date(), 0, 'no-store'],
    [new Date(Date.now() + 300000), 0, 'no-store'],
    [new Date(0), 120, 'no-store'],
    [new Date(Date.now() - 5000), 120, 'no-store'],
    [new Date(), 120, 'no-store'],
    [new Date(Date.now() + 300000), 120, 'max-age=120'],
    [new Date(Date.now() + 360000), 300, 'max-age=300'],
    [new Date(Date.now() + 300000), 600, 'max-age=300']
  ])(
    'should calculate cache control header value',
    (fragmentExpirationTime: Date, pageMaxAge: number | undefined, expectedCacheControlHeaderValue: string) => {
      // given
      const transclusionResult = new TransclusionResult('content', new CacheStats());
      transclusionResult.addResolvedInclude(
        new Include('').resolveWith(new Fragment(200, '', undefined, fragmentExpirationTime))
      );

      // expect
      expect(transclusionResult.calculateCacheControlHeaderValue(pageMaxAge)).toBe(expectedCacheControlHeaderValue);
    }
  );

  it.each([
    [new Date(0), new Headers(), 'no-store'],
    [new Date(Date.now() - 5000), new Headers(), 'no-store'],
    [new Date(), new Headers(), 'no-store'],
    [new Date(Date.now() + 300000), new Headers(), 'no-store'],
    [new Date(0), new Headers([['Cache-Control', 'no-cache']]), 'no-store'],
    [new Date(Date.now() - 5000), new Headers([['Cache-Control', 'no-cache']]), 'no-store'],
    [new Date(), new Headers([['Cache-Control', 'no-cache']]), 'no-store'],
    [new Date(Date.now() + 300000), new Headers([['Cache-Control', 'no-cache']]), 'no-store'],
    [new Date(0), new Headers([['Cache-Control', 'max-age=0']]), 'no-store'],
    [new Date(Date.now() - 5000), new Headers([['Cache-Control', 'max-age=0']]), 'no-store'],
    [new Date(), new Headers([['Cache-Control', 'max-age=0']]), 'no-store'],
    [new Date(Date.now() + 300000), new Headers([['Cache-Control', 'max-age=0']]), 'no-store'],
    [new Date(0), new Headers([['Cache-Control', 'max-age=120']]), 'no-store'],
    [new Date(Date.now() - 5000), new Headers([['Cache-Control', 'max-age=120']]), 'no-store'],
    [new Date(), new Headers([['Cache-Control', 'max-age=120']]), 'no-store'],
    [new Date(Date.now() + 300000), new Headers([['Cache-Control', 'max-age=120']]), 'max-age=120'],
    [new Date(Date.now() + 300000), new Headers([['Cache-Control', 'max-age=300']]), 'max-age=300'],
    [new Date(Date.now() + 300000), new Headers([['Cache-Control', 'max-age=600']]), 'max-age=300']
  ])(
    'should calculate cache control header value based on given response headers',
    (fragmentExpirationTime: Date, responseHeaders: Headers, expectedCacheControlHeaderValue: string) => {
      // given
      const transclusionResult = new TransclusionResult('content', new CacheStats());
      transclusionResult.addResolvedInclude(
        new Include('').resolveWith(new Fragment(200, '', undefined, fragmentExpirationTime))
      );

      // expect
      expect(transclusionResult.calculateCacheControlHeaderValueByResponseHeaders(responseHeaders)).toBe(
        expectedCacheControlHeaderValue
      );
    }
  );

  it('should handle missing content expiration time when calculating cache control header value', () => {
    expect(
      new TransclusionResult('', new CacheStats()).calculateCacheControlHeaderValueByResponseHeaders(new Headers())
    ).toBe('no-store');
  });

  it('should calculate content expiration time correctly for content without fragments', () => {
    expect(
      new TransclusionResult('', new CacheStats()).calculateCacheControlHeaderValueByResponseHeaders(
        new Headers([['Cache-Control', 'max-age=60']])
      )
    ).toBe('max-age=60');
  });

  it('should not append stats to content by default', () => {
    expect(new TransclusionResult('content', new CacheStats()).getContent()).toBe('content');
  });

  it('should append stats to content - zero includes', () => {
    expect(new TransclusionResult('content', new CacheStats(), true).getContent()).toBe(
      'content\n' +
        '<!-- Ableron stats:\n' +
        'Processed 0 includes in 0ms\n' +
        '\n' +
        'Cache Stats: 0 hits, 0 misses, 0 successful refreshs, 0 failed refreshs\n' +
        '-->'
    );
  });

  it('should append stats to content', async () => {
    // given
    const server: FastifyInstance = Fastify();
    const transclusionProcessor = new TransclusionProcessor(
      new AbleronConfig({ statsAppendToContent: true, statsExposeFragmentUrl: true }),
      new NoOpLogger()
    );
    const serverAddress = (path: string) => {
      const address = ['127.0.0.1', '::1'].includes(server.addresses()[0].address)
        ? 'localhost'
        : server.addresses()[0].address;
      return 'http://' + address + ':' + server.addresses()[0].port + '/' + path.replace(/^\//, '');
    };
    server.get('/uncacheable-fragment', function (request, reply) {
      reply.status(200).header('Cache-Control', 'no-store').send('uncacheable-fragment');
    });
    server.get('/cacheable-fragment-1', function (request, reply) {
      reply.status(200).header('Expires', 'Wed, 12 Oct 2050 07:28:00 GMT').send('cacheable-fragment-1');
    });
    server.get('/cacheable-fragment-2', function (request, reply) {
      reply.status(200).header('Cache-Control', 'max-age=10').send('cacheable-fragment-2');
    });
    await server.listen();
    await transclusionProcessor.resolveIncludes(
      `<ableron-include src="${serverAddress('/cacheable-fragment-2')}" />`,
      new Headers()
    );

    // when
    const result = await transclusionProcessor.resolveIncludes(
      `<ableron-include id="1">fallback content</ableron-include>
       <ableron-include id="2" src="${serverAddress('/uncacheable-fragment')}" />
       <ableron-include id="3" src="${serverAddress('/cacheable-fragment-1')}" />
       <ableron-include id="4" fallback-src="${serverAddress('/cacheable-fragment-2')}" />`,
      new Headers()
    );

    // then
    expect(
      result
        .getContent()
        .replace(/\d+ms/g, 'XXXms')
        .replace(/localhost:\d+\//g, 'localhost:80/')
        .replace(/expires in \d{3,}s/g, 'expires in XXXs')
    ).toBe(
      'fallback content\n' +
        '       uncacheable-fragment\n' +
        '       cacheable-fragment-1\n' +
        '       cacheable-fragment-2\n' +
        '<!-- Ableron stats:\n' +
        'Processed 4 includes in XXXms\n' +
        '\n' +
        'Time | Include | Resolved With | Fragment Cacheability | Fragment URL\n' +
        '------------------------------------------------------\n' +
        'XXXms | 1 | fallback content | - | -\n' +
        'XXXms | 2 | remote src | not cacheable | http://localhost:80/uncacheable-fragment\n' +
        'XXXms | 3 | remote src | expires in XXXs | http://localhost:80/cacheable-fragment-1\n' +
        'XXXms | 4 | cached fallback-src | expires in 10s | http://localhost:80/cacheable-fragment-2\n' +
        '\n' +
        'Cache Stats: 1 hits, 3 misses, 0 successful refreshs, 0 failed refreshs\n' +
        '-->'
    );
  });

  it('should not expose fragment URL to stats by default', () => {
    // given
    const transclusionResult = new TransclusionResult('', new CacheStats(), true);

    // when
    transclusionResult.addResolvedInclude(new Include('').resolveWith(new Fragment(200, '', 'example.com'), 71, 'src'));

    // then
    expect(transclusionResult.getContent()).toBe(
      '\n' +
        '<!-- Ableron stats:\n' +
        'Processed 1 include in 0ms\n' +
        '\n' +
        'Time | Include | Resolved With | Fragment Cacheability\n' +
        '------------------------------------------------------\n' +
        '71ms | da39a3e | src | not cacheable\n' +
        '\n' +
        'Cache Stats: 0 hits, 0 misses, 0 successful refreshs, 0 failed refreshs\n' +
        '-->'
    );
  });

  it('should append stats for primary include', () => {
    // given
    const transclusionResult = new TransclusionResult('', new CacheStats(), true);

    // when
    transclusionResult.addResolvedInclude(
      new Include('include#1', new Map([['primary', '']])).resolveWith(new Fragment(200, ''))
    );

    // then
    expect(transclusionResult.getContent()).toBe(
      '\n' +
        '<!-- Ableron stats:\n' +
        'Processed 1 include in 0ms\n' +
        '\n' +
        'Time | Include | Resolved With | Fragment Cacheability\n' +
        '------------------------------------------------------\n' +
        '0ms | ceef048 (primary) | fallback content | -\n' +
        '\n' +
        'Cache Stats: 0 hits, 0 misses, 0 successful refreshs, 0 failed refreshs\n' +
        '-->'
    );
  });

  it('should append stats for multiple primary includes', () => {
    // given
    const transclusionResult = new TransclusionResult('', new CacheStats(), true);

    // when
    transclusionResult.addResolvedInclude(
      new Include('include#1', new Map([['primary', '']])).resolveWith(new Fragment(200, ''))
    );
    transclusionResult.addResolvedInclude(
      new Include('include#2', new Map([['primary', '']])).resolveWith(new Fragment(200, ''), 33)
    );

    // then
    expect(transclusionResult.getContent()).toBe(
      '\n' +
        '<!-- Ableron stats:\n' +
        'Processed 2 includes in 0ms\n' +
        '\n' +
        'Time | Include | Resolved With | Fragment Cacheability\n' +
        '------------------------------------------------------\n' +
        '33ms | a57865f (primary) | fallback content | -\n' +
        '0ms | ceef048 (primary) | fallback content | -\n' +
        '\n' +
        'Cache Stats: 0 hits, 0 misses, 0 successful refreshs, 0 failed refreshs\n' +
        '-->'
    );
  });
});
