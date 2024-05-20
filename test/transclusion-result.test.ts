import { describe, expect, it } from 'vitest';
import { AbleronConfig, TransclusionResult } from '../src/index.js';
import Include from '../src/include.js';
import Fragment from '../src/fragment.js';
import Fastify, { FastifyInstance } from 'fastify';
import TransclusionProcessor from '../src/transclusion-processor';
import { NoOpLogger } from '../src/logger';

describe('Transclusion result', () => {
  it('should return reasonable defaults', () => {
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

  it('should set processing time', () => {
    // given
    const transclusionResult = new TransclusionResult('content');

    // when
    transclusionResult.setProcessingTimeMillis(111);

    // then
    expect(transclusionResult.getProcessingTimeMillis()).toBe(111);
  });

  it('should handle resolved include correctly', () => {
    // given
    const transclusionResult = new TransclusionResult('content: <include>');
    const include = new Include('<include>', new Map([['primary', '']]), 'fallback');
    const fragment = new Fragment(404, 'not found', undefined, new Date(0), new Headers([['X-Test', 'Foo']]));

    // when
    transclusionResult.addResolvedInclude(include.resolveWith(fragment));

    // then
    expect(transclusionResult.getContent()).toBe('content: not found');
    expect(transclusionResult.getContentExpirationTime()).toEqual(new Date(0));
    expect(transclusionResult.getHasPrimaryInclude()).toBe(true);
    expect(transclusionResult.getStatusCodeOverride()).toBe(404);
    expect(transclusionResult.getResponseHeadersToPass()).toEqual(new Headers([['X-Test', 'Foo']]));
    expect(transclusionResult.getProcessedIncludesCount()).toBe(1);
    expect(transclusionResult.getProcessingTimeMillis()).toBe(0);
  });

  //TODO: Check Stats is the only thing we can do
  // it('should handle unresolvable include correctly', () => {
  //   // given
  //   const transclusionResult = new TransclusionResult('content: <include>');
  //
  //   // when
  //   transclusionResult.addUnresolvableInclude(new Include('<include>', new Map(), 'fallback'));
  //
  //   // then
  //   expect(transclusionResult.getContent()).toBe('content: fallback');
  //   expect(transclusionResult.getContentExpirationTime()).toEqual(new Date(0));
  //   expect(transclusionResult.getHasPrimaryInclude()).toBe(false);
  //   expect(transclusionResult.getStatusCodeOverride()).toBeUndefined();
  //   expect(transclusionResult.getResponseHeadersToPass()).toEqual(new Headers());
  //   expect(transclusionResult.getProcessedIncludesCount()).toBe(1);
  //   expect(transclusionResult.getProcessingTimeMillis()).toBe(0);
  // });

  it.each([
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
    [new Date(new Date().getTime() + 360000), 300, 'max-age=300'],
    [new Date(new Date().getTime() + 300000), 600, 'max-age=300']
  ])(
    'should calculate cache control header value',
    (fragmentExpirationTime: Date, pageMaxAge: number | undefined, expectedCacheControlHeaderValue: string) => {
      // given
      const transclusionResult = new TransclusionResult('content');
      transclusionResult.addResolvedInclude(
        new Include('').resolveWith(new Fragment(200, '', undefined, fragmentExpirationTime))
      );

      // expect
      expect(transclusionResult.calculateCacheControlHeaderValue(pageMaxAge)).toBe(expectedCacheControlHeaderValue);
    }
  );

  it.each([
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
    expect(new TransclusionResult('').calculateCacheControlHeaderValueByResponseHeaders(new Headers())).toBe(
      'no-store'
    );
  });

  it('should not append stats to content by default', () => {
    expect(new TransclusionResult('content').getContent()).toBe('content');
  });

  it('should append stats to content - zero includes', () => {
    expect(new TransclusionResult('content', true).getContent()).toBe(
      'content\n<!-- Ableron stats:\nProcessed 0 include(s) in 0ms\n-->'
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
    expect(result.getContent()).toContain('fallback content');
    expect(result.getContent()).toContain('uncacheable-fragment');
    expect(result.getContent()).toContain('cacheable-fragment-1');
    expect(result.getContent()).toContain('cacheable-fragment-2');
    expect(result.getContent()).toMatch(/<!-- Ableron stats:\nProcessed 4 include\(s\) in \d+ms/);
    expect(result.getContent()).toContain('Time | Include | Resolved With | Fragment Cacheability | Fragment URL');
    expect(result.getContent()).toContain('------------------------------------------------------');
    expect(result.getContent()).toMatch(/\d+ms \| 1 \| fallback content \| - \| -/);
    expect(result.getContent()).toMatch(
      /\d+ms \| 2 \| remote src \| not cacheable \| http:\/\/localhost:\d+\/uncacheable-fragment/
    );
    expect(result.getContent()).toMatch(
      /\d+ms \| 3 \| remote src \| cached - expires in \d+s \| http:\/\/localhost:\d+\/cacheable-fragment-1/
    );
    expect(result.getContent()).toMatch(
      /0ms \| 4 \| cached fallback-src \| cached - expires in 9s \| http:\/\/localhost:\d+\/cacheable-fragment-2/
    );
  });

  it('should not expose fragment URL to stats by default', () => {
    // given
    const transclusionResult = new TransclusionResult('', true);

    // when
    transclusionResult.addResolvedInclude(new Include('').resolveWith(new Fragment(200, '', 'example.com'), 71, 'src'));

    // then
    expect(transclusionResult.getContent()).toBe(
      '\n<!-- Ableron stats:\n' +
        'Processed 1 include(s) in 0ms\n\n' +
        'Time | Include | Resolved With | Fragment Cacheability\n' +
        '------------------------------------------------------\n' +
        '71ms | da39a3e | src | not cacheable\n' +
        '-->'
    );
  });

  it('should append stats for primary include', () => {
    // given
    const transclusionResult = new TransclusionResult('', true);

    // when
    transclusionResult.addResolvedInclude(
      new Include('include#1', new Map([['primary', '']])).resolveWith(new Fragment(200, ''))
    );

    // then
    expect(transclusionResult.getContent()).toBe(
      '\n<!-- Ableron stats:\n' +
        'Processed 1 include(s) in 0ms\n\n' +
        'Time | Include | Resolved With | Fragment Cacheability\n' +
        '------------------------------------------------------\n' +
        '0ms | ceef048 (primary) | fallback content | -\n' +
        '-->'
    );
  });

  it('should append stats for multiple primary includes', () => {
    // given
    const transclusionResult = new TransclusionResult('', true);

    // when
    transclusionResult.addResolvedInclude(
      new Include('include#1', new Map([['primary', '']])).resolveWith(new Fragment(200, ''))
    );
    transclusionResult.addResolvedInclude(
      new Include('include#2', new Map([['primary', '']])).resolveWith(new Fragment(200, ''), 33)
    );

    // then
    expect(transclusionResult.getContent()).toBe(
      '\n<!-- Ableron stats:\n' +
        'Processed 2 include(s) in 0ms\n\n' +
        'Time | Include | Resolved With | Fragment Cacheability\n' +
        '------------------------------------------------------\n' +
        '33ms | a57865f (primary) | fallback content | -\n' +
        '0ms | ceef048 (primary) | fallback content | -\n' +
        '-->'
    );
  });
});
