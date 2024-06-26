import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import TransclusionProcessor from '../src/transclusion-processor.js';
import { AbleronConfig } from '../src/index.js';
import Fastify, { FastifyInstance } from 'fastify';
import { NoOpLogger } from '../src/logger';

let server: FastifyInstance | undefined;
const transclusionProcessor = new TransclusionProcessor(new AbleronConfig(), new NoOpLogger());

beforeEach(() => {
  server = undefined;
});

afterEach(async () => {
  transclusionProcessor.getFragmentCache().clear();

  if (server) {
    await server.close();
  }
});

function serverAddress(path: string): string {
  if (server) {
    const address = ['127.0.0.1', '::1'].includes(server.addresses()[0].address)
      ? 'localhost'
      : server.addresses()[0].address;
    return 'http://' + address + ':' + server.addresses()[0].port + '/' + path.replace(/^\//, '');
  }

  return 'undefined';
}

describe('TransclusionProcessor', () => {
  it.each([
    ['<ableron-include src="test"/>', '<ableron-include src="test"/>'],
    ['<ableron-include src="test" />', '<ableron-include src="test" />'],
    ['<ableron-include\nsrc="test" />', '<ableron-include\nsrc="test" />'],
    ['<ableron-include\tsrc="test"\t\t/>', '<ableron-include\tsrc="test"\t\t/>'],
    ['<ableron-include src="test"></ableron-include>', '<ableron-include src="test"></ableron-include>'],
    ['<ableron-include src="test"> </ableron-include>', '<ableron-include src="test"> </ableron-include>'],
    [
      '<ableron-include src="test">foo\nbar\nbaz</ableron-include>',
      '<ableron-include src="test">foo\nbar\nbaz</ableron-include>'
    ],
    ['<ableron-include src=">>"/>', '<ableron-include src=">>"/>'],
    ['<ableron-include src="/>"/>', '<ableron-include src="/>"/>'],
    ['\n<ableron-include src="..."/>\n', '<ableron-include src="..."/>'],
    ['<div><ableron-include src="..."/></div>', '<ableron-include src="..."/>'],
    ['<ableron-include src="..."  fallback-src="..."/>', '<ableron-include src="..."  fallback-src="..."/>'],
    ['<ableron-include src="test" primary/>', '<ableron-include src="test" primary/>'],
    ['<ableron-include src="test" primary="primary"/>', '<ableron-include src="test" primary="primary"/>']
  ])('should recognize includes of different forms', (content: string, expectedRawIncludeTag: string) => {
    expect(transclusionProcessor.findIncludes(content)[0].getRawIncludeTag()).toBe(expectedRawIncludeTag);
  });

  it.each([
    ['<ableron-include/>'],
    ['<ableron-include >'],
    ['<ableron-include src="s">'],
    ['<ableron-include src="s" b="b">']
  ])('should not recognize includes with invalid format', (content: string) => {
    expect(transclusionProcessor.findIncludes(content)).toHaveLength(0);
  });

  it('should accept line breaks in include tag attributes', () => {
    // when
    const include = transclusionProcessor.findIncludes(
      '<ableron-include\nsrc="https://foo.bar/fragment-1"\nfallback-src="https://foo.bar/fragment-1-fallback"/>'
    )[0];

    // then
    expect(include.getSrc()).toBe('https://foo.bar/fragment-1');
    expect(include.getFallbackSrc()).toBe('https://foo.bar/fragment-1-fallback');
  });

  it.each([
    ['<ableron-include src="https://example.com"/>', new Map([['src', 'https://example.com']])],
    ['<ableron-include  src="https://example.com"/>', new Map([['src', 'https://example.com']])],
    ['<ableron-include   src="https://example.com"/>', new Map([['src', 'https://example.com']])],
    ['<ableron-include -src="https://example.com"/>', new Map([['-src', 'https://example.com']])],
    ['<ableron-include _src="https://example.com"/>', new Map([['_src', 'https://example.com']])],
    ['<ableron-include 0src="https://example.com"/>', new Map([['0src', 'https://example.com']])],
    [
      '<ableron-include foo="" src="https://example.com"/>',
      new Map([
        ['foo', ''],
        ['src', 'https://example.com']
      ])
    ],
    [
      '<ableron-include src="source" fallback-src="fallback"/>',
      new Map([
        ['src', 'source'],
        ['fallback-src', 'fallback']
      ])
    ],
    [
      '<ableron-include fallback-src="fallback" src="source"/>',
      new Map([
        ['src', 'source'],
        ['fallback-src', 'fallback']
      ])
    ],
    [
      '<ableron-include src=">" fallback-src="/>"/>',
      new Map([
        ['src', '>'],
        ['fallback-src', '/>']
      ])
    ],
    [
      '<ableron-include src="https://example.com" primary/>',
      new Map([
        ['src', 'https://example.com'],
        ['primary', '']
      ])
    ],
    [
      '<ableron-include primary src="https://example.com"/>',
      new Map([
        ['src', 'https://example.com'],
        ['primary', '']
      ])
    ],
    [
      '<ableron-include src="https://example.com" primary="primary"/>',
      new Map([
        ['src', 'https://example.com'],
        ['primary', 'primary']
      ])
    ],
    [
      '<ableron-include src="https://example.com" primary="foo"/>',
      new Map([
        ['src', 'https://example.com'],
        ['primary', 'foo']
      ])
    ]
  ])('should parse include tag attributes', (content: string, expectedRawAttributes: Map<string, string>) => {
    expect(transclusionProcessor.findIncludes(content)[0].getRawAttributes()).toEqual(expectedRawAttributes);
  });

  it('should find all includes in input content', () => {
    expect(
      transclusionProcessor
        .findIncludes(
          `<html>
        <head>
        <ableron-include src="https://foo.bar/baz?test=123" />
        <title>Foo</title>
        <ableron-include foo="bar" src="https://foo.bar/baz?test=456"/>
        </head>
        <body>
        <ableron-include src="https://foo.bar/baz?test=789" fallback-src="https://example.com"/>
        <ableron-include src="https://foo.bar/baz?test=789" fallback-src="https://example.com">fallback</ableron-include>
        </body>
        </html>`
        )
        .map((include) => include.getRawIncludeTag())
    ).toEqual([
      '<ableron-include src="https://foo.bar/baz?test=123" />',
      '<ableron-include foo="bar" src="https://foo.bar/baz?test=456"/>',
      '<ableron-include src="https://foo.bar/baz?test=789" fallback-src="https://example.com"/>',
      '<ableron-include src="https://foo.bar/baz?test=789" fallback-src="https://example.com">fallback</ableron-include>'
    ]);
  });

  it('should treat multiple identical includes as one include', () => {
    expect(
      transclusionProcessor
        .findIncludes(
          `<html>
        <head>
          <ableron-include src="https://foo.bar/baz?test=123"/>
          <ableron-include src="https://foo.bar/baz?test=123"/>
          <title>Foo</title>
          <ableron-include foo="bar" src="https://foo.bar/baz?test=456"></ableron-include>
          <ableron-include foo="bar" src="https://foo.bar/baz?test=456"></ableron-include>
          </head>
          <body>
          <ableron-include src="...">...</ableron-include>
        <ableron-include src="...">...</ableron-include>
        </body>
        </html>`
        )
        .map((include) => include.getRawIncludeTag())
    ).toEqual([
      '<ableron-include src="https://foo.bar/baz?test=123"/>',
      '<ableron-include foo="bar" src="https://foo.bar/baz?test=456"></ableron-include>',
      '<ableron-include src="...">...</ableron-include>'
    ]);
  });

  it('should perform search for includes in big input string', () => {
    // given
    let randomStringWithoutIncludes = '';

    for (let i = 0; i < 512 * 1024; i++) {
      // @see https://stackoverflow.com/questions/1527803/generating-random-whole-numbers-in-javascript-in-a-specific-range#1527820
      // Code Points 32 (inclusive) - 127 (exclusive) = Printable ASCII Characters from Space to Tilde
      randomStringWithoutIncludes += String.fromCodePoint(Math.floor(Math.random() * (127 - 32 + 1)) + 32);
    }

    const randomStringWithIncludeAtTheBeginning = '<ableron-include />' + randomStringWithoutIncludes;
    const randomStringWithIncludeAtTheEnd = randomStringWithoutIncludes + '<ableron-include />';
    const randomStringWithIncludeAtTheMiddle =
      randomStringWithoutIncludes + '<ableron-include />' + randomStringWithoutIncludes;

    // expect
    expect(transclusionProcessor.findIncludes(randomStringWithoutIncludes)).toHaveLength(0);
    expect(transclusionProcessor.findIncludes(randomStringWithIncludeAtTheBeginning)).toHaveLength(1);
    expect(transclusionProcessor.findIncludes(randomStringWithIncludeAtTheEnd)).toHaveLength(1);
    expect(transclusionProcessor.findIncludes(randomStringWithIncludeAtTheMiddle)).toHaveLength(1);
  });

  it('should populate TransclusionResult', async () => {
    // when
    const result = await transclusionProcessor.resolveIncludes(
      `<html>
    <head>
      <ableron-include src="https://foo.bar/baz?test=123"><!-- failed loading 1st include --></ableron-include>
    <title>Foo</title>
    <ableron-include foo="bar" src="https://foo.bar/baz?test=456"><!-- failed loading 2nd include --></ableron-include>
    </head>
    <body>
    <ableron-include src="https://foo.bar/baz?test=789"><!-- failed loading 3rd include --></ableron-include>
    </body>
    </html>`,
      new Headers()
    );

    // then
    expect(result.getProcessedIncludesCount()).toBe(3);
    expect(result.getProcessingTimeMillis()).toBeGreaterThanOrEqual(1);
    expect(result.getContent()).toBe(
      `<html>
    <head>
      <!-- failed loading 1st include -->
    <title>Foo</title>
    <!-- failed loading 2nd include -->
    </head>
    <body>
    <!-- failed loading 3rd include -->
    </body>
    </html>`
    );
  });

  it('should populate TransclusionResult with primary include status code', async () => {
    // given
    server = Fastify();
    server.get('/header', function (request, reply) {
      reply.status(200).send('header-fragment');
    });
    server.get('/footer', function (request, reply) {
      reply.status(200).send('footer-fragment');
    });
    server.get('/main', function (request, reply) {
      reply.status(301).header('Location', '/foobar').send('main-fragment');
    });
    await server.listen();

    // when
    const result = await transclusionProcessor.resolveIncludes(
      `<ableron-include src="${serverAddress('/header')}" />
    <ableron-include src="${serverAddress('/main')}" primary="primary"><!-- failure --></ableron-include>
    <ableron-include src="${serverAddress('/footer')}" />`,
      new Headers()
    );

    // then
    expect(result.getContent()).toBe(
      `header-fragment
    main-fragment
    footer-fragment`
    );
    expect(result.getHasPrimaryInclude()).toBe(true);
    expect(result.getStatusCodeOverride()).toBe(301);
    expect(result.getResponseHeadersToPass()).toEqual(new Headers([['location', '/foobar']]));
  });

  it('should set content expiration time to lowest fragment expiration time', async () => {
    // given
    server = Fastify();
    server.get('/header', function (request, reply) {
      reply.status(200).header('Cache-Control', 'max-age=120').send('header-fragment');
    });
    server.get('/footer', function (request, reply) {
      reply.status(200).header('Cache-Control', 'max-age=60').send('footer-fragment');
    });
    server.get('/main', function (request, reply) {
      reply.status(200).header('Cache-Control', 'max-age=30').send('main-fragment');
    });
    await server.listen();

    // when
    const result = await transclusionProcessor.resolveIncludes(
      `<ableron-include src="${serverAddress('/header')}"/>
    <ableron-include src="${serverAddress('/main')}"/>
    <ableron-include src="${serverAddress('/footer')}"/>`,
      new Headers()
    );

    // then
    expect(result.getContent()).toBe(
      `header-fragment
    main-fragment
    footer-fragment`
    );
    expect((result.getContentExpirationTime() as Date) < new Date(Date.now() + 31000)).toBe(true);
    expect((result.getContentExpirationTime() as Date) > new Date(Date.now() + 27000)).toBe(true);
  });

  it('should set content expiration time to past if a fragment must not be cached', async () => {
    // given
    server = Fastify();
    server.get('/header', function (request, reply) {
      reply.status(200).header('Cache-Control', 'max-age=120').send('header-fragment');
    });
    server.get('/footer', function (request, reply) {
      reply.status(200).header('Cache-Control', 'max-age=60').send('footer-fragment');
    });
    server.get('/main', function (request, reply) {
      reply.status(200).header('Cache-Control', 'no-store, no-cache, must-revalidate').send('main-fragment');
    });
    await server.listen();

    // when
    const result = await transclusionProcessor.resolveIncludes(
      `<ableron-include src="${serverAddress('/header')}"/>
    <ableron-include src="${serverAddress('/main')}"/>
    <ableron-include src="${serverAddress('/footer')}"/>`,
      new Headers()
    );

    // then
    expect(result.getContent()).toBe(
      `header-fragment
    main-fragment
    footer-fragment`
    );
    expect(result.getContentExpirationTime() as Date).toEqual(new Date(0));
  });

  it('should prevent caching if no fragment provides explicit caching information', async () => {
    // given
    server = Fastify();
    server.get('/header', function (request, reply) {
      reply.status(200).send('header-fragment');
    });
    server.get('/footer', function (request, reply) {
      reply.status(200).send('footer-fragment');
    });
    server.get('/main', function (request, reply) {
      reply.status(200).send('main-fragment');
    });
    await server.listen();

    // when
    const result = await transclusionProcessor.resolveIncludes(
      `<ableron-include src="${serverAddress('/header')}"/>
    <ableron-include src="${serverAddress('/main')}"/>
    <ableron-include src="${serverAddress('/footer')}"/>`,
      new Headers()
    );

    // then
    expect(result.getContent()).toBe(
      `header-fragment
    main-fragment
    footer-fragment`
    );
    expect(result.getContentExpirationTime() as Date).toEqual(new Date(0));
  });

  it('should replace identical includes', async () => {
    // when
    const result = await transclusionProcessor.resolveIncludes(
      `<ableron-include src="foo-bar"><!-- #1 --></ableron-include>
      <ableron-include src="foo-bar"><!-- #1 --></ableron-include>
      <ableron-include src="foo-bar"><!-- #1 --></ableron-include>
      <ableron-include src="foo-bar"><!-- #2 --></ableron-include>`,
      new Headers()
    );

    // then
    expect(result.getContent()).toBe(
      `<!-- #1 -->
      <!-- #1 -->
      <!-- #1 -->
      <!-- #2 -->`
    );
    expect(result.getContentExpirationTime() as Date).toEqual(new Date(0));
  });

  it.each([
    ['invalid src url', '<ableron-include src=",._">fallback</ableron-include>', 'fallback'],
    ['invalid src timeout', '<ableron-include src-timeout-millis="5s">fallback</ableron-include>', 'fallback'],
    [
      'invalid fallback-src timeout',
      '<ableron-include fallback-src-timeout-millis="5s">fallback</ableron-include>',
      'fallback'
    ]
  ])('should replace identical includes', async (scenarioName: string, includeTag: string, expectedResult: string) => {
    // when
    const result = await transclusionProcessor.resolveIncludes(
      '<ableron-include >before</ableron-include>' + includeTag + '<ableron-include >after</ableron-include>',
      new Headers()
    );

    // then
    expect(result.getContent()).toBe('before' + expectedResult + 'after');
  });

  it('should resolve includes in parallel', async () => {
    // given
    server = Fastify();
    const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));
    server.get('/503', async function (request, reply) {
      await sleep(2000);
      reply.status(503).send('fragment-1');
    });
    server.get('/1000ms-delay', async function (request, reply) {
      await sleep(1000);
      reply.status(200).send('fragment-2');
    });
    server.get('/2000ms-delay', async function (request, reply) {
      await sleep(2000);
      reply.status(200).send('fragment-3');
    });
    server.get('/2100ms-delay', async function (request, reply) {
      await sleep(2100);
      reply.status(200).send('fragment-4');
    });
    server.get('/2200ms-delay', async function (request, reply) {
      await sleep(2200);
      reply.status(200).send('fragment-5');
    });
    await server.listen();

    // when
    const result = await transclusionProcessor.resolveIncludes(
      `<html>
     <head>
       <ableron-include src="${serverAddress('/503')}"><!-- failed loading fragment #1 --></ableron-include>
       <title>Foo</title>
       <ableron-include src="${serverAddress('/1000ms-delay')}"><!-- failed loading fragment #2 --></ableron-include>
     </head>
     <body>
       <ableron-include src="${serverAddress('/2000ms-delay')}"><!-- failed loading fragment #3 --></ableron-include>
       <ableron-include src="${serverAddress('/2100ms-delay')}"><!-- failed loading fragment #4 --></ableron-include>
       <ableron-include src="${serverAddress('/2200ms-delay')}"><!-- failed loading fragment #5 --></ableron-include>
       <ableron-include src="${serverAddress('/expect-404')}"><!-- failed loading fragment #6 --></ableron-include>
     </body>
     </html>`,
      new Headers()
    );

    // then
    expect(result.getContent()).toBe(
      `<html>
     <head>
       <!-- failed loading fragment #1 -->
       <title>Foo</title>
       fragment-2
     </head>
     <body>
       fragment-3
       fragment-4
       fragment-5
       <!-- failed loading fragment #6 -->
     </body>
     </html>`
    );
  });

  it('should handle unresolvable include', async () => {
    // given
    const transclusionProcessor = new TransclusionProcessor(
      new AbleronConfig({ statsAppendToContent: true }),
      new NoOpLogger()
    );
    const parentRequestHeaders = vi.fn() as any as Headers;

    // when
    const result = await transclusionProcessor.resolveIncludes(
      '<ableron-include ><!-- fallback content --></ableron-include>',
      parentRequestHeaders
    );

    // then
    expect(result.getContent()).toMatch(
      /^<!-- fallback content -->\n<!-- Ableron stats:\nProcessed 1 include\(s\) in \d+ms/gm
    );
    expect(result.getContent()).toMatch(/^\d+ms \| ce164c3 \| fallback content \| -$/gm);
    expect(result.getContentExpirationTime().getTime()).toBeLessThanOrEqual(new Date(Date.now() + 60000).getTime());
    expect(result.getContentExpirationTime().getTime()).toBeGreaterThanOrEqual(new Date(Date.now() + 58000).getTime());
  });

  it('should record stats', async () => {
    // given
    const transclusionProcessor = new TransclusionProcessor(
      new AbleronConfig({ statsAppendToContent: true }),
      new NoOpLogger()
    );
    server = Fastify();
    server.get('/200-cacheable', async function (request, reply) {
      reply.status(200).header('Cache-Control', 'max-age=60').send('200-cacheable');
    });
    server.get('/200-not-cacheable', async function (request, reply) {
      reply.status(200).send('200-not-cacheable');
    });
    server.get('/404', async function (request, reply) {
      reply.status(404).send('404');
    });
    server.get('/503', async function (request, reply) {
      reply.status(503).send('503');
    });
    await server.listen();

    // when
    await transclusionProcessor.resolveIncludes(
      `
       <ableron-include src="${serverAddress('/200-cacheable')}"/>
       <ableron-include src="${serverAddress('/200-not-cacheable')}"/>
       <ableron-include src="${serverAddress('/404')}"/>
       <ableron-include src="${serverAddress('/503')}"/>`,
      new Headers()
    );
    await transclusionProcessor.resolveIncludes(
      `
       <ableron-include src="${serverAddress('/200-cacheable')}"/>
       <ableron-include src="${serverAddress('/200-not-cacheable')}"/>
       <ableron-include src="${serverAddress('/404')}" primary/>
       <ableron-include src="${serverAddress('/503')}" fallback-src="${serverAddress('/404')}" primary/>`,
      new Headers()
    );
    await transclusionProcessor.resolveIncludes(
      `
       <ableron-include src="${serverAddress('/200-cacheable')}"/>
       <ableron-include src="${serverAddress('/200-not-cacheable')}"/>
       <ableron-include src="${serverAddress('/404')}" fallback-src="${serverAddress('/200-cacheable')}" primary/>
       <ableron-include src="${serverAddress('/404')}" fallback-src="${serverAddress('/503')}"/>`,
      new Headers()
    );
    const result = await transclusionProcessor.resolveIncludes(
      `
       <ableron-include id="5" src="${serverAddress('/200-cacheable')}"/>
       <ableron-include id="e" src="${serverAddress('/200-not-cacheable')}"/>
       <ableron-include id="4" src="${serverAddress('/404')}"><!-- error --></ableron-include>
       <ableron-include id="h" src="${serverAddress('/404')}" fallback-src="${serverAddress('/503')}" primary><!-- error --></ableron-include>
       <ableron-include id="z" fallback-src="${serverAddress('/200-not-cacheable')}"/>
       <ableron-include id="b" src="${serverAddress('/503')}" fallback-src="${serverAddress('/200-cacheable')}"><!-- error --></ableron-include>`,
      new Headers()
    );

    // then
    expect(
      result
        .getContent()
        .replace(/\d+ms/g, 'XXXms')
        .replace(/(60|59)s/g, '60s')
    ).toBe(
      '\n' +
        '       200-cacheable\n' +
        '       200-not-cacheable\n' +
        '       <!-- error -->\n' +
        '       404\n' +
        '       200-not-cacheable\n' +
        '       200-cacheable\n' +
        '<!-- Ableron stats:\n' +
        'Processed 6 include(s) in XXXms\n' +
        '\n' +
        'Time | Include | Resolved With | Fragment Cacheability\n' +
        '------------------------------------------------------\n' +
        'XXXms | 4 | fallback content | -\n' +
        'XXXms | 5 | cached src | expires in 60s\n' +
        'XXXms | b | cached fallback-src | expires in 60s\n' +
        'XXXms | e | remote src | not cacheable\n' +
        'XXXms | h (primary) | remote src | not cacheable\n' +
        'XXXms | z | remote fallback-src | not cacheable\n' +
        '\n' +
        'Cache Stats: 5 hits, 18 misses, 0 successful refreshs, 0 failed refreshs\n' +
        '-->'
    );
  });
});
