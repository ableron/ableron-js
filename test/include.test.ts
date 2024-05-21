import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import Include from '../src/include.js';
import Fastify, { FastifyInstance } from 'fastify';
import { AbleronConfig } from '../src/index.js';
import TransclusionProcessor from '../src/transclusion-processor.js';
import Fragment from '../src/fragment.js';
import { NoOpLogger } from '../src/logger';

const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));

let server: FastifyInstance | undefined;
const config = new AbleronConfig({
  fragmentRequestTimeoutMillis: 1000
});
const fragmentCache = new TransclusionProcessor(config, new NoOpLogger()).getFragmentCache();

beforeEach(() => {
  server = undefined;
});

afterEach(async () => {
  fragmentCache.clear();

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

describe('Include', () => {
  it('should set raw attributes in constructor', () => {
    // given
    const rawAttributes = new Map([['src', 'https://example.com']]);

    // expect
    expect(new Include('', rawAttributes).getRawAttributes()).toEqual(rawAttributes);
  });

  it.each([
    [new Include(''), ''],
    [new Include('', undefined, 'fallback'), 'fallback']
  ])('should set fallback content in constructor', (include: Include, expectedFallbackContent: string) => {
    expect(include.getFallbackContent()).toBe(expectedFallbackContent);
  });

  it('should set raw include tag in constructor', () => {
    // given
    const rawIncludeTag = '<ableron-include src="https://example.com"/>';

    // expect
    expect(new Include(rawIncludeTag).getRawIncludeTag()).toBe(rawIncludeTag);
  });

  it.each([
    [new Include('', new Map()), 'da39a3e'],
    [new Include('', new Map([['id', 'foo-bar']])), 'foo-bar'],
    [new Include('', new Map([['id', 'FOO-bar%baz__/5']])), 'FOO-barbaz__5'],
    [new Include('', new Map([['id', '//']])), 'da39a3e'],
    [new Include('zzzzz'), 'a2b7cad'],
    [new Include('zzzzzz'), '984ff6e']
  ])('should handle include id', (include: Include, expectedId: string) => {
    expect(include.getId()).toBe(expectedId);
  });

  it.each([
    [new Include(''), undefined],
    [new Include('', new Map([['src', 'https://example.com']])), 'https://example.com']
  ])('should set src attribute in constructor', (include: Include, expectedSrc?: string) => {
    expect(include.getSrc()).toBe(expectedSrc);
  });

  it.each([
    [new Include(''), undefined],
    [new Include('', new Map([['src-timeout-millis', '2000']])), 2000],
    [new Include('', new Map([['src-timeout-millis', '2s']])), undefined]
  ])('should set src timeout attribute in constructor', (include: Include, expectedSrcTimeout?: number) => {
    expect(include.getSrcTimeoutMillis()).toBe(expectedSrcTimeout);
  });

  it.each([
    [new Include(''), undefined],
    [new Include('', new Map([['fallback-src', 'https://example.com']])), 'https://example.com']
  ])('should set fallback-src attribute in constructor', (include: Include, expectedFallbackSrc?: string) => {
    expect(include.getFallbackSrc()).toBe(expectedFallbackSrc);
  });

  it.each([
    [new Include(''), undefined],
    [new Include('', new Map([['fallback-src-timeout-millis', '2000']])), 2000],
    [new Include('', new Map([['fallback-src-timeout-millis', '2s']])), undefined]
  ])(
    'should set fallback-src timeout attribute in constructor',
    (include: Include, expectedFallbackSrcTimeout?: number) => {
      expect(include.getFallbackSrcTimeoutMillis()).toBe(expectedFallbackSrcTimeout);
    }
  );

  it.each([
    [new Include(''), false],
    [new Include('', new Map([['primary', '']])), true],
    [new Include('', new Map([['primary', 'primary']])), true],
    [new Include('', new Map([['primary', 'PRIMARY']])), true],
    [new Include('', new Map([['primary', 'nope']])), false]
  ])('should set primary attribute in constructor', (include: Include, expectedPrimary: boolean) => {
    expect(include.isPrimary()).toBe(expectedPrimary);
  });

  it('should resolve with src', async () => {
    // given
    server = Fastify();
    server.get('/', function (request, reply) {
      reply.status(206).send('response');
    });
    await server.listen();

    // when
    const include = await new Include('', new Map([['src', serverAddress('/')]])).resolve(config, fragmentCache);

    // then
    expect(include.isResolved()).toBe(true);
    expect(include.getResolvedFragment().content).toBe('response');
    expect(include.getResolvedFragment().statusCode).toBe(206);
    expect(include.getResolvedFragmentSource()).toBe('remote src');
    expect(include.getResolveTimeMillis()).toBeGreaterThan(0);
  });

  it('should resolve with fallback-src if src could not be loaded', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply.status(500).send('fragment from src');
    });
    server.get('/fallback-src', function (request, reply) {
      reply.status(200).send('fragment from fallback-src');
    });
    await server.listen();

    // when
    const include = await new Include(
      '',
      new Map([
        ['src', serverAddress('/src')],
        ['fallback-src', serverAddress('/fallback-src')]
      ])
    ).resolve(config, fragmentCache);

    // then
    expect(include.isResolved()).toBe(true);
    expect(include.getResolvedFragment().content).toBe('fragment from fallback-src');
    expect(include.getResolvedFragment().statusCode).toBe(200);
    expect(include.getResolvedFragmentSource()).toBe('remote fallback-src');
    expect(include.getResolveTimeMillis()).toBeGreaterThan(0);
  });

  it('should resolve with fallback content if src and fallback-src could not be loaded', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply.status(500).send('fragment from src');
    });
    server.get('/fallback-src', function (request, reply) {
      reply.status(500).send('fragment from fallback-src');
    });
    await server.listen();

    // when
    const include = await new Include(
      '',
      new Map([
        ['src', serverAddress('/src')],
        ['fallback-src', serverAddress('/fallback-src')]
      ]),
      'fallback content'
    ).resolve(config, fragmentCache);

    // then
    expect(include.isResolved()).toBe(true);
    expect(include.getResolvedFragment().content).toBe('fallback content');
    expect(include.getResolvedFragment().statusCode).toBe(200);
    expect(include.getResolvedFragmentSource()).toBe('fallback content');
    expect(include.getResolveTimeMillis()).toBeGreaterThan(0);
  });

  it('should resolve to empty string if src, fallback src and fallback content are not present', async () => {
    // when
    const include = await new Include('').resolve(config, fragmentCache);

    // then
    expect(include.isResolved()).toBe(true);
    expect(include.getResolvedFragment().content).toBe('');
    expect(include.getResolvedFragment().statusCode).toBe(200);
    expect(include.getResolvedFragmentSource()).toBe('fallback content');
  });

  it('should handle primary include with errored src', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply.status(503).send('fragment from src');
    });
    await server.listen();

    // when
    const include = await new Include(
      '',
      new Map([
        ['src', serverAddress('/src')],
        ['primary', 'primary']
      ])
    ).resolve(config, fragmentCache);

    // then
    expect(include.isResolved()).toBe(true);
    expect(include.getResolvedFragment().content).toBe('fragment from src');
    expect(include.getResolvedFragment().statusCode).toBe(503);
    expect(include.getResolvedFragmentSource()).toBe('remote src');
    expect(include.getResolveTimeMillis()).toBeGreaterThan(0);
  });

  it('should handle primary include without src and with errored fallback-src', async () => {
    // given
    server = Fastify();
    server.get('/fallback-src-503', function (request, reply) {
      reply.status(503).send('fragment from fallback-src-503');
    });
    await server.listen();

    // when
    const include = await new Include(
      '',
      new Map([
        ['fallback-src', serverAddress('/fallback-src-503')],
        ['primary', 'primary']
      ])
    ).resolve(config, fragmentCache);

    // then
    expect(include.isResolved()).toBe(true);
    expect(include.getResolvedFragment().content).toBe('fragment from fallback-src-503');
    expect(include.getResolvedFragment().statusCode).toBe(503);
    expect(include.getResolvedFragmentSource()).toBe('remote fallback-src');
    expect(include.getResolveTimeMillis()).toBeGreaterThan(0);
  });

  it('should handle primary include with errored src and successfully resolved fallback-src', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply.status(500).send('fragment from src');
    });
    server.get('/fallback-src', function (request, reply) {
      reply.status(206).send('fragment from fallback-src');
    });
    await server.listen();

    // when
    const include = await new Include(
      '',
      new Map([
        ['src', serverAddress('/src')],
        ['fallback-src', serverAddress('/fallback-src')],
        ['primary', '']
      ])
    ).resolve(config, fragmentCache);

    // then
    expect(include.isResolved()).toBe(true);
    expect(include.getResolvedFragment().content).toBe('fragment from fallback-src');
    expect(include.getResolvedFragment().statusCode).toBe(206);
    expect(include.getResolvedFragmentSource()).toBe('remote fallback-src');
    expect(include.getResolveTimeMillis()).toBeGreaterThan(0);
  });

  it('should handle primary include with errored src and errored fallback-src', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply.status(503).send('fragment from src');
    });
    server.get('/fallback-src', function (request, reply) {
      reply.status(500).send('fragment from fallback_src');
    });
    await server.listen();

    // when
    const include = await new Include(
      '',
      new Map([
        ['src', serverAddress('/src')],
        ['fallback-src', serverAddress('/fallback-src')],
        ['primary', '']
      ])
    ).resolve(config, fragmentCache);

    // then
    expect(include.isResolved()).toBe(true);
    expect(include.getResolvedFragment().content).toBe('fragment from src');
    expect(include.getResolvedFragment().statusCode).toBe(503);
    expect(include.getResolvedFragmentSource()).toBe('remote src');
    expect(include.getResolveTimeMillis()).toBeGreaterThan(0);
  });

  it('should reset errored fragment of primary include for consecutive resolving', async () => {
    // given
    server = Fastify();
    let reqCounter = 0;
    server.get('/src', function (request, reply) {
      if (reqCounter++ === 0) {
        reply.status(503).send('fragment from src');
      } else {
        reply.status(504).send('fragment from src 2nd call');
      }
    });
    server.get('/fallback-src', function (request, reply) {
      reply.status(500).send('fragment from fallback-src');
    });
    await server.listen();
    const include = new Include(
      '',
      new Map([
        ['src', serverAddress('/src')],
        ['fallback-src', serverAddress('/fallback-src')],
        ['primary', '']
      ])
    );

    // when
    const resolvedInclude1 = await include.resolve(config, fragmentCache);

    // then
    expect(resolvedInclude1.isResolved()).toBe(true);
    expect(resolvedInclude1.getResolvedFragment().content).toBe('fragment from src');
    expect(resolvedInclude1.getResolvedFragment().statusCode).toBe(503);
    expect(resolvedInclude1.getResolvedFragmentSource()).toBe('remote src');
    expect(resolvedInclude1.getResolveTimeMillis()).toBeGreaterThan(0);

    // when
    const resolvedInclude2 = await include.resolve(config, fragmentCache);

    // then
    expect(resolvedInclude2.isResolved()).toBe(true);
    expect(resolvedInclude2.getResolvedFragment().content).toBe('fragment from src 2nd call');
    expect(resolvedInclude2.getResolvedFragment().statusCode).toBe(504);
    expect(resolvedInclude2.getResolvedFragmentSource()).toBe('remote src');
    expect(resolvedInclude2.getResolveTimeMillis()).toBeGreaterThan(0);
  });

  it('should ignore fallback content and set fragment status code and body of errored src if primary', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply.status(503).send('fragment from src');
    });
    await server.listen();

    // when
    const include = await new Include(
      '',
      new Map([
        ['src', serverAddress('/src')],
        ['primary', '']
      ]),
      'fallback content'
    ).resolve(config, fragmentCache);

    // then
    expect(include.isResolved()).toBe(true);
    expect(include.getResolvedFragment().content).toBe('fragment from src');
    expect(include.getResolvedFragment().statusCode).toBe(503);
    expect(include.getResolvedFragmentSource()).toBe('remote src');
    expect(include.getResolveTimeMillis()).toBeGreaterThan(0);
  });

  it('should not follow redirects when resolving URLs', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply.status(302).header('Location', serverAddress('/src-after-redirect')).send();
    });
    server.get('/src-after-redirect', function (request, reply) {
      reply.status(200).send('fragment from src after redirect');
    });
    await server.listen();

    // when
    const include = await new Include('', new Map([['src', serverAddress('/src')]]), 'fallback content').resolve(
      config,
      fragmentCache
    );

    // then
    expect(include.isResolved()).toBe(true);
    expect(include.getResolvedFragment().content).toBe('fallback content');
    expect(include.getResolvedFragment().statusCode).toBe(200);
    expect(include.getResolvedFragmentSource()).toBe('fallback content');
    expect(include.getResolveTimeMillis()).toBeGreaterThan(0);
  });

  it.each([
    [new Date(new Date().getTime() + 5000), 'fragment from cache', 'cached src'],
    [new Date(new Date().getTime() - 5000), 'fragment from src', 'remote src']
  ])(
    'should use cached fragment if not expired',
    async (expirationTime: Date, expectedFragmentContent: string, expectedFragmentSource: string) => {
      // given
      server = Fastify();
      server.get('/src', function (request, reply) {
        reply.status(200).send('fragment from src');
      });
      await server.listen();

      // when
      fragmentCache.set(serverAddress('/src'), new Fragment(200, 'fragment from cache', undefined, expirationTime), {
        ttl: Math.max(1, expirationTime.getTime() - new Date().getTime())
      });
      await sleep(2);
      const include = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(config, fragmentCache);

      // then
      expect(include.isResolved()).toBe(true);
      expect(include.getResolvedFragment().content).toBe(expectedFragmentContent);
      expect(include.getResolvedFragment().statusCode).toBe(200);
      expect(include.getResolvedFragmentSource()).toBe(expectedFragmentSource);
    }
  );

  it.each([
    [100, 'fragment', false, ':(', 200],
    [200, 'fragment', true, 'fragment', 200],
    [202, 'fragment', false, ':(', 200],
    [203, 'fragment', true, 'fragment', 203],
    [204, '', true, '', 204],
    [205, 'fragment', false, ':(', 200],
    [206, 'fragment', true, 'fragment', 206],
    [300, 'fragment', true, ':(', 200],
    [302, 'fragment', false, ':(', 200],
    [400, 'fragment', false, ':(', 200],
    [404, 'fragment', true, ':(', 200],
    [405, 'fragment', true, ':(', 200],
    [410, 'fragment', true, ':(', 200],
    [414, 'fragment', true, ':(', 200],
    [500, 'fragment', false, ':(', 200],
    [501, 'fragment', true, ':(', 200],
    [502, 'fragment', false, ':(', 200],
    [503, 'fragment', false, ':(', 200],
    [504, 'fragment', false, ':(', 200],
    [505, 'fragment', false, ':(', 200],
    [506, 'fragment', false, ':(', 200],
    [507, 'fragment', false, ':(', 200],
    [508, 'fragment', false, ':(', 200],
    [509, 'fragment', false, ':(', 200],
    [510, 'fragment', false, ':(', 200],
    [511, 'fragment', false, ':(', 200]
  ])(
    'should cache fragment if status code is defined as cacheable in RFC 7231 - Status %i',
    async (
      responseStatus: number,
      srcFragment: string,
      expectedFragmentCached: boolean,
      expectedFragment: string,
      expectedFragmentStatusCode: number
    ) => {
      // given
      server = Fastify();
      server.get('/src', function (request, reply) {
        reply.status(responseStatus).header('Cache-Control', 'max-age=7200').send(srcFragment);
      });
      await server.listen();

      // when
      const include = await new Include('', new Map([['src', serverAddress('/src')]]), ':(').resolve(
        config,
        fragmentCache
      );

      // then
      expect(include.isResolved()).toBe(true);
      expect(include.getResolvedFragment().content).toBe(expectedFragment);
      expect(include.getResolvedFragment().statusCode).toBe(expectedFragmentStatusCode);
      expect(include.getResolvedFragmentSource()).toBe(expectedFragment == ':(' ? 'fallback content' : 'remote src');

      if (expectedFragmentCached) {
        expect(fragmentCache.get(serverAddress('/src'))).toBeDefined();
      } else {
        expect(fragmentCache.get(serverAddress('/src'))).toBeUndefined();
      }
    }
  );

  it('should cache fragment for s-maxage seconds if directive is present', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply
        .status(200)
        .header('Cache-Control', 'max-age=3600, s-maxage=604800 , public')
        .header('Expires', 'Wed, 21 Oct 2015 07:28:00 GMT')
        .send('fragment from src');
    });
    await server.listen();

    // when
    const include = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(config, fragmentCache);
    const cachedFragment = fragmentCache.get(serverAddress('/src')) as Fragment;

    // then
    expect(include.isResolved()).toBe(true);
    expect(include.getResolvedFragment().content).toBe('fragment from src');
    expect(cachedFragment).toBeDefined();
    expect(cachedFragment.expirationTime < new Date(new Date().getTime() + 604800000 + 1000)).toBe(true);
    expect(cachedFragment.expirationTime > new Date(new Date().getTime() + 604800000 - 1000)).toBe(true);
  });

  it('should cache fragment for max-age seconds if directive is present', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply
        .status(200)
        .header('Cache-Control', 'max-age=3600')
        .header('Expires', 'Wed, 21 Oct 2015 07:28:00 GMT')
        .send('fragment from src');
    });
    await server.listen();

    // when
    const include = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(config, fragmentCache);
    const cachedFragment = fragmentCache.get(serverAddress('/src')) as Fragment;

    // then
    expect(include.isResolved()).toBe(true);
    expect(include.getResolvedFragment().content).toBe('fragment from src');
    expect(cachedFragment).toBeDefined();
    expect(cachedFragment.expirationTime < new Date(new Date().getTime() + 3600000 + 1000)).toBe(true);
    expect(cachedFragment.expirationTime > new Date(new Date().getTime() + 3600000 - 1000)).toBe(true);
  });

  it('should treat http header names as case insensitive', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply.status(200).header('cache-control', 'max-age=3600').send('fragment from src');
    });
    await server.listen();

    // when
    const include = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(config, fragmentCache);
    const cachedFragment = fragmentCache.get(serverAddress('/src')) as Fragment;

    // then
    expect(include.getResolvedFragment().content).toBe('fragment from src');
    expect(cachedFragment).toBeDefined();
    expect(cachedFragment.expirationTime < new Date(new Date().getTime() + 3600000 + 1000)).toBe(true);
    expect(cachedFragment.expirationTime > new Date(new Date().getTime() + 3600000 - 1000)).toBe(true);
  });

  it('should cache fragment for max-age seconds minus Age seconds if directive is present and Age header is set', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply
        .status(200)
        .header('Cache-Control', 'max-age=3600')
        .header('Age', '600')
        .header('Expires', 'Wed, 21 Oct 2015 07:28:00 GMT')
        .send('fragment from src');
    });
    await server.listen();

    // when
    const include = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(config, fragmentCache);
    const cachedFragment = fragmentCache.get(serverAddress('/src')) as Fragment;

    // then
    expect(include.getResolvedFragment().content).toBe('fragment from src');
    expect(cachedFragment).toBeDefined();
    expect(cachedFragment.expirationTime < new Date(new Date().getTime() + 3000000 + 1000)).toBe(true);
    expect(cachedFragment.expirationTime > new Date(new Date().getTime() + 3000000 - 1000)).toBe(true);
  });

  it('should use absolute value of Age header for cache expiration calculation', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply
        .status(200)
        .header('Cache-Control', 'max-age=3600')
        .header('Age', '-100')
        .header('Expires', 'Wed, 21 Oct 2015 07:28:00 GMT')
        .send('fragment from src');
    });
    await server.listen();

    // when
    const include = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(config, fragmentCache);
    const cachedFragment = fragmentCache.get(serverAddress('/src')) as Fragment;

    // then
    expect(include.getResolvedFragment().content).toBe('fragment from src');
    expect(cachedFragment).toBeDefined();
    expect(cachedFragment.expirationTime < new Date(new Date().getTime() + 3500000 + 1000)).toBe(true);
    expect(cachedFragment.expirationTime > new Date(new Date().getTime() + 3500000 - 1000)).toBe(true);
  });

  it('should cache fragment based on Expires header and current time if Cache-Control header and Date header are not present', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply
        .status(200)
        .header('Cache-Control', 'public')
        .header('Expires', 'Wed, 12 Oct 2050 07:28:00 GMT')
        .send('fragment from src');
    });
    await server.listen();

    // when
    const include = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(config, fragmentCache);
    const cachedFragment = fragmentCache.get(serverAddress('/src')) as Fragment;

    // then
    expect(include.getResolvedFragment().content).toBe('fragment from src');
    expect(cachedFragment).toBeDefined();
    expect(cachedFragment.expirationTime.toUTCString()).toBe('Wed, 12 Oct 2050 07:28:00 GMT');
  });

  it('should handle Expires header with value 0', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply.status(200).header('Expires', '0').send('fragment from src');
    });
    await server.listen();

    // when
    const include = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(config, fragmentCache);

    // then
    expect(include.getResolvedFragment().content).toBe('fragment from src');
    expect(fragmentCache.get(serverAddress('/src'))).toBeUndefined();
  });

  it('should cache fragment based on Expires and Date header if Cache-Control header is not present', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply
        .status(200)
        .header('Date', 'Wed, 05 Oct 2050 07:28:00 GMT')
        .header('Expires', 'Wed, 12 Oct 2050 07:28:00 GMT')
        .send('fragment from src');
    });
    await server.listen();

    // when
    const include = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(config, fragmentCache);
    const cachedFragment = fragmentCache.get(serverAddress('/src')) as Fragment;

    // then
    expect(include.getResolvedFragment().content).toBe('fragment from src');
    expect(cachedFragment).toBeDefined();
    expect(cachedFragment.expirationTime < new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000 + 1000)).toBe(true);
    expect(cachedFragment.expirationTime > new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000 - 1000)).toBe(true);
  });

  it('should not cache fragment if Cache-Control header is set but without max-age directives', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply.status(200).header('Cache-Control', 'no-cache,no-store,must-revalidate').send('fragment from src');
    });
    await server.listen();

    // when
    const include = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(config, fragmentCache);

    // then
    expect(include.getResolvedFragment().content).toBe('fragment from src');
    expect(fragmentCache.get(serverAddress('/src'))).toBeUndefined();
  });

  it.each([
    ['Cache-Control', 's-maxage=not-numeric', 'X-Dummy', 'dummy'],
    ['Cache-Control', 'max-age=not-numeric', 'X-Dummy', 'dummy'],
    ['Cache-Control', 'max-age=3600', 'Age', 'not-numeric'],
    ['Expires', 'not-numeric', 'X-Dummy', 'dummy'],
    ['Expires', 'Wed, 12 Oct 2050 07:28:00 GMT', 'Date', 'not-a-date']
  ])(
    'should not crash when cache headers contain invalid values',
    async (header1Name: string, header1Value: string, header2Name: string, header2Value: string) => {
      // given
      server = Fastify();
      server.get('/src', function (request, reply) {
        reply.status(200).header(header1Name, header1Value).header(header2Name, header2Value).send('fragment from src');
      });
      await server.listen();

      // when
      const include = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(config, fragmentCache);

      // then
      expect(include.getResolvedFragment().content).toBe('fragment from src');
    }
  );

  it('should not cache fragment if no expiration time is indicated via response header', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply.status(200).send('fragment from src');
    });
    await server.listen();

    // when
    const include = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(config, fragmentCache);

    // then
    expect(include.getResolvedFragment().content).toBe('fragment from src');
    expect(fragmentCache.get(serverAddress('/src'))).toBeUndefined();
  });

  it('should apply request timeout', async () => {
    // given
    server = Fastify();
    server.get('/src', async function (request, reply) {
      await sleep(2000);
      reply.status(200).send('fragment from src');
    });
    await server.listen();

    // when
    const include = await new Include('', new Map([['src', serverAddress('/src')]]), 'fallback content').resolve(
      config,
      fragmentCache
    );

    // then
    expect(include.getResolvedFragment().content).toBe('fallback content');
  });

  it.each([
    ['src', new Map(), ''],
    ['src', new Map([['src-timeout-millis', '2000']]), 'fragment'],
    ['src', new Map([['fallback-src-timeout-millis', '2000']]), ''],
    ['fallback-src', new Map(), ''],
    ['fallback-src', new Map([['fallback-src-timeout-millis', '2000']]), 'fragment'],
    ['fallback-src', new Map([['src-timeout-millis', '2000']]), '']
  ])(
    'should favor include tag specific request timeout over global one - %s, %o',
    async (srcAttributeName: string, timeoutAttribute: Map<string, string>, expectedFragmentContent: string) => {
      // given
      server = Fastify();
      server.get('/', async function (request, reply) {
        await sleep(1200);
        reply.status(200).send('fragment');
      });
      await server.listen();

      // when
      const rawAttributes = new Map([[srcAttributeName, serverAddress('/')]]);
      timeoutAttribute.forEach((value, key) => rawAttributes.set(key, value));
      const include = await new Include('', new Map(rawAttributes)).resolve(config, fragmentCache);

      // then
      expect(include.getResolvedFragment().content).toBe(expectedFragmentContent);
    }
  );

  it('should pass allowed request headers to fragment requests', async () => {
    // given
    server = Fastify();
    let lastRecordedRequestHeaders;
    server.get('/src', function (request, reply) {
      lastRecordedRequestHeaders = request.headers;
      reply.status(204).send();
    });
    await server.listen();

    // when
    await new Include('', new Map([['src', serverAddress('/src')]])).resolve(
      new AbleronConfig({
        fragmentRequestHeadersToPass: ['X-Default'],
        fragmentAdditionalRequestHeadersToPass: ['X-Additional']
      }),
      fragmentCache,
      new Headers([
        ['X-Default', 'Foo'],
        ['X-Additional', 'Bar']
      ])
    );

    // then
    expect(new Headers(lastRecordedRequestHeaders).get('X-default')).toBe('Foo');
    expect(new Headers(lastRecordedRequestHeaders).get('X-additional')).toBe('Bar');
  });

  it('should extend default allowed fragment request headers with additional allowed fragment request headers', async () => {
    // given
    server = Fastify();
    let lastRecordedRequestHeaders;
    server.get('/src', function (request, reply) {
      lastRecordedRequestHeaders = request.headers;
      reply.status(204).send();
    });
    await server.listen();

    // when
    await new Include('', new Map([['src', serverAddress('/src')]])).resolve(
      new AbleronConfig({
        fragmentAdditionalRequestHeadersToPass: ['X-Additional']
      }),
      fragmentCache,
      new Headers([
        ['X-Correlation-ID', 'Foo'],
        ['X-Additional', 'Bar'],
        ['X-Test', 'Baz']
      ])
    );

    // then
    expect(new Headers(lastRecordedRequestHeaders).get('X-Correlation-ID')).toBe('Foo');
    expect(new Headers(lastRecordedRequestHeaders).get('X-Additional')).toBe('Bar');
    expect(new Headers(lastRecordedRequestHeaders).get('X-Test')).toBeNull;
  });

  it('should treat fragment request headers allow list as case insensitive', async () => {
    // given
    server = Fastify();
    let lastRecordedRequestHeaders;
    server.get('/src', function (request, reply) {
      lastRecordedRequestHeaders = request.headers;
      reply.status(204).send();
    });
    await server.listen();

    // when
    await new Include('', new Map([['src', serverAddress('/src')]])).resolve(
      new AbleronConfig({ fragmentRequestHeadersToPass: ['X-TeSt'] }),
      fragmentCache,
      new Headers([['x-tEsT', 'Foo']])
    );

    // then
    expect(new Headers(lastRecordedRequestHeaders).get('X-Test')).toBe('Foo');
  });

  it('should not pass non-allowed request headers to fragment requests', async () => {
    // given
    server = Fastify();
    let lastRecordedRequestHeaders;
    server.get('/src', function (request, reply) {
      lastRecordedRequestHeaders = request.headers;
      reply.status(204).send();
    });
    await server.listen();

    // when
    await new Include('', new Map([['src', serverAddress('/src')]])).resolve(
      new AbleronConfig({ fragmentRequestHeadersToPass: [] }),
      fragmentCache,
      new Headers([['X-Test', 'Foo']])
    );

    // then
    expect(new Headers(lastRecordedRequestHeaders).get('X-Test')).toBeNull();
  });

  it('should pass default User-Agent header to fragment requests', async () => {
    // given
    server = Fastify();
    let lastRecordedRequestHeaders;
    server.get('/src', function (request, reply) {
      lastRecordedRequestHeaders = request.headers;
      reply.status(204).send();
    });
    await server.listen();

    // when
    await new Include('', new Map([['src', serverAddress('/src')]])).resolve(config, fragmentCache);

    // then
    expect(
      ['undici', 'node'].includes(new Headers(lastRecordedRequestHeaders).get('User-Agent') as string)
    ).toBeTruthy();
  });

  it('should pass provided User-Agent header to fragment requests by default', async () => {
    // given
    server = Fastify();
    let lastRecordedRequestHeaders;
    server.get('/src', function (request, reply) {
      lastRecordedRequestHeaders = request.headers;
      reply.status(204).send();
    });
    await server.listen();

    // when
    await new Include('', new Map([['src', serverAddress('/src')]])).resolve(
      config,
      fragmentCache,
      new Headers([['user-agent', 'test']])
    );

    // then
    expect(new Headers(lastRecordedRequestHeaders).get('User-Agent')).toBe('test');
  });

  it('should pass allowed response headers of primary fragment to transclusion result', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply.status(200).header('X-Test', 'Test').send();
    });
    await server.listen();

    // when
    const include = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(
      new AbleronConfig({ primaryFragmentResponseHeadersToPass: ['X-Test'] }),
      fragmentCache
    );

    // then
    expect(include.getResolvedFragment().responseHeaders).toEqual(new Headers([['x-test', 'Test']]));
  });

  it('should not pass allowed response headers of non-primary fragment to transclusion result', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply.status(200).header('X-Test', 'Test').send();
    });
    await server.listen();

    // when
    const include = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(config, fragmentCache);

    // then
    expect(include.getResolvedFragment().responseHeaders).toEqual(new Headers());
  });

  it('should treat fragment response headers allow list as case insensitive', async () => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply.status(200).header('x-test', 'Test').send();
    });
    await server.listen();

    // when
    const include = await new Include(
      '',
      new Map([
        ['src', serverAddress('/src')],
        ['primary', '']
      ])
    ).resolve(new AbleronConfig({ primaryFragmentResponseHeadersToPass: ['X-TeSt'] }), fragmentCache);

    // then
    expect(include.getResolvedFragment().responseHeaders.get('x-test')).toBe('Test');
  });

  it('should not collapse requests', async () => {
    // given
    server = Fastify();
    let reqCounter = 0;
    server.get('/src', async function (request, reply) {
      await sleep(200);
      reply
        .status(200)
        .header('Cache-Control', 'max-age=30')
        .send('request ' + ++reqCounter);
    });
    await server.listen();
    const include = new Include('', new Map([['src', serverAddress('/src')]]));

    // when
    const fragment1 = include.resolve(config, fragmentCache);
    const fragment2 = include.resolve(config, fragmentCache);
    const fragment3 = include.resolve(config, fragmentCache);
    const fragment4 = new Include('', new Map([['src', serverAddress('/404')]]), '404 not found').resolve(
      config,
      fragmentCache
    );

    // and
    await Promise.all([fragment1, fragment2, fragment3, fragment4]);

    // then
    expect(reqCounter).toBe(3);
  });

  it('should consider cacheVaryByRequestHeaders', async () => {
    // given
    server = Fastify();
    let reqCounter = 0;
    server.get('/src', function (request, reply) {
      reply
        .status(200)
        .header('Cache-Control', 'max-age=30')
        .send('request X-AB-Test=' + request.headers['x-ab-test'] + ' | ' + ++reqCounter);
    });
    await server.listen();
    const config = new AbleronConfig({
      fragmentRequestHeadersToPass: ['x-ab-TEST', 'x-ab-TEST-1', 'x-ab-TEST-2'],
      cacheVaryByRequestHeaders: ['x-AB-test', 'x-AB-test-1', 'x-AB-test-2']
    });

    // when
    const resolvedInclude1 = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(
      config,
      fragmentCache,
      new Headers([
        ['X-AB-TEST', 'A'],
        ['X-AB-TEST-2', 'A'],
        ['X-AB-TEST-1', 'A']
      ])
    );
    const resolvedInclude2 = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(
      config,
      fragmentCache,
      new Headers([
        ['X-AB-TEST', 'A'],
        ['X-AB-TEST-1', 'A'],
        ['X-AB-TEST-2', 'A']
      ])
    );
    const resolvedInclude3 = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(
      config,
      fragmentCache,
      new Headers([['X-AB-TEST', 'B']])
    );
    const resolvedInclude4 = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(
      config,
      fragmentCache,
      new Headers([
        ['X-AB-TEST', 'B'],
        ['X-Foo', 'Bar']
      ])
    );
    const resolvedInclude5 = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(
      config,
      fragmentCache
    );
    const resolvedInclude6 = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(
      config,
      fragmentCache,
      new Headers([
        ['X-AB-TEST-2', 'A'],
        ['X-AB-TEST-1', 'A'],
        ['X-AB-TEST', 'A']
      ])
    );
    const resolvedInclude7 = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(
      config,
      fragmentCache,
      new Headers([
        ['X-AB-TEST-2', ''],
        ['X-AB-TEST-1', 'A'],
        ['X-AB-TEST', 'A']
      ])
    );
    const resolvedInclude8 = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(
      config,
      fragmentCache,
      new Headers([
        ['X-AB-TEST-1', 'A'],
        ['X-AB-TEST', 'A']
      ])
    );

    // then
    expect(resolvedInclude1.getResolvedFragment().content).toBe('request X-AB-Test=A | 1');
    expect(resolvedInclude2.getResolvedFragment().content).toBe('request X-AB-Test=A | 1');
    expect(resolvedInclude3.getResolvedFragment().content).toBe('request X-AB-Test=B | 2');
    expect(resolvedInclude4.getResolvedFragment().content).toBe('request X-AB-Test=B | 2');
    expect(resolvedInclude5.getResolvedFragment().content).toBe('request X-AB-Test=undefined | 3');
    expect(resolvedInclude6.getResolvedFragment().content).toBe('request X-AB-Test=A | 1');
    expect(resolvedInclude7.getResolvedFragment().content).toBe('request X-AB-Test=A | 4');
    expect(resolvedInclude8.getResolvedFragment().content).toBe('request X-AB-Test=A | 4');
  });

  it('should use consistent order of cacheVaryByRequestHeaders for cache key generation', async () => {
    // given
    server = Fastify();
    let reqCounter = 0;
    server.get('/src', function (request, reply) {
      reply
        .status(200)
        .header('Cache-Control', 'max-age=30')
        .send('request ' + ++reqCounter);
    });
    await server.listen();
    const config = new AbleronConfig({
      fragmentRequestHeadersToPass: ['X-Test-A', 'X-Test-B', 'X-Test-C'],
      cacheVaryByRequestHeaders: ['X-Test-A', 'X-Test-B', 'X-Test-C']
    });

    // when
    const resolvedInclude1 = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(
      config,
      fragmentCache,
      new Headers([
        ['X-TEST-A', 'A'],
        ['X-Test-B', 'B'],
        ['X-Test-C', 'C']
      ])
    );
    const resolvedInclude2 = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(
      config,
      fragmentCache,
      new Headers([
        ['X-TEST-B', 'B'],
        ['X-Test-A', 'A'],
        ['X-Test-C', 'C']
      ])
    );
    const resolvedInclude3 = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(
      config,
      fragmentCache,
      new Headers([
        ['X-TEST-C', 'C'],
        ['X-Test-B', 'B'],
        ['X-Test-A', 'A']
      ])
    );
    const resolvedInclude4 = await new Include('', new Map([['src', serverAddress('/src')]])).resolve(
      config,
      fragmentCache,
      new Headers([
        ['x-test-c', 'B'],
        ['x-test-b', 'B'],
        ['x-test-a', 'A']
      ])
    );

    // then
    expect(resolvedInclude1.getResolvedFragment().content).toBe('request 1');
    expect(resolvedInclude2.getResolvedFragment().content).toBe('request 1');
    expect(resolvedInclude3.getResolvedFragment().content).toBe('request 1');
    expect(resolvedInclude4.getResolvedFragment().content).toBe('request 2');
  });
});
