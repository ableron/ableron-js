import { Include } from '../src/include';
import Fastify, { FastifyInstance } from 'fastify';
import { AbleronConfig } from '../src';
import { TransclusionProcessor } from '../src/transclusion-processor';
import { Fragment } from '../src/fragment';

let server: FastifyInstance | undefined;
const config = new AbleronConfig({
  fragmentRequestTimeoutMillis: 1000
});
const fragmentCache = new TransclusionProcessor(config).getFragmentCache();

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

test('should resolve include with URL provided via src attribute', async () => {
  // given
  server = Fastify();
  server.get('/', function (request, reply) {
    reply.status(200).send('response');
  });
  await server.listen({ port: 3000 });

  // when
  const fragment = await new Include(new Map([['src', serverAddress('/')]])).resolve(config, fragmentCache);

  // then
  expect(fragment.content).toBe('response');
});

test('should resolve include with URL provided via fallback-src attribute if src could not be loaded', async () => {
  // given
  server = Fastify();
  server.get('/src', function (request, reply) {
    reply.status(500).send('fragment from src');
  });
  server.get('/fallback-src', function (request, reply) {
    reply.status(200).send('fragment from fallback-src');
  });
  await server.listen({ port: 3000 });

  // when
  const fragment = await new Include(
    new Map([
      ['src', serverAddress('/src')],
      ['fallback-src', serverAddress('/fallback-src')]
    ])
  ).resolve(config, fragmentCache);

  // then
  expect(fragment.content).toBe('fragment from fallback-src');
});

test('should resolve include with fallback content if src and fallback-src could not be loaded', async () => {
  // given
  server = Fastify();
  server.get('/src', function (request, reply) {
    reply.status(500).send('fragment from src');
  });
  server.get('/fallback-src', function (request, reply) {
    reply.status(500).send('fragment from fallback-src');
  });
  await server.listen({ port: 3000 });

  // when
  const fragment = await new Include(
    new Map([
      ['src', serverAddress('/src')],
      ['fallback-src', serverAddress('/fallback-src')]
    ]),
    'fallback content'
  ).resolve(config, fragmentCache);

  // then
  expect(fragment.content).toBe('fallback content');
});

test('should resolve include to empty string if src, fallback src and fallback content are not present', async () => {
  // when
  const fragment = await new Include().resolve(config, fragmentCache);

  // then
  expect(fragment.content).toBe('');
});

test('should set fragment status code for successfully resolved src', async () => {
  // given
  server = Fastify();
  server.get('/src', function (request, reply) {
    reply.status(206).send('fragment from src');
  });
  await server.listen({ port: 3000 });

  // when
  const fragment = await new Include(new Map([['src', serverAddress('/src')]])).resolve(config, fragmentCache);

  // then
  expect(fragment.content).toBe('fragment from src');
  expect(fragment.statusCode).toBe(206);
});

test('should set fragment status code for successfully resolved fallback-src of primary include', async () => {
  // given
  server = Fastify();
  server.get('/src', function (request, reply) {
    reply.status(500).send('fragment from src');
  });
  server.get('/fallback-src', function (request, reply) {
    reply.status(206).send('fragment from fallback-src');
  });
  await server.listen({ port: 3000 });

  // when
  const fragment = await new Include(
    new Map([
      ['src', serverAddress('/src')],
      ['fallback-src', serverAddress('/fallback-src')],
      ['primary', '']
    ])
  ).resolve(config, fragmentCache);

  // then
  expect(fragment.content).toBe('fragment from fallback-src');
  expect(fragment.statusCode).toBe(206);
});

test('should set fragment status code and body of errored src', async () => {
  // given
  server = Fastify();
  server.get('/src', function (request, reply) {
    reply.status(503).send('fragment from src');
  });
  await server.listen({ port: 3000 });

  // when
  const fragment = await new Include(
    new Map([
      ['src', serverAddress('/src')],
      ['primary', 'primary']
    ])
  ).resolve(config, fragmentCache);

  // then
  expect(fragment.content).toBe('fragment from src');
  expect(fragment.statusCode).toBe(503);
});

test('should set fragment status code of errored src also if fallback-src errored for primary include', async () => {
  // given
  server = Fastify();
  server.get('/src', function (request, reply) {
    reply.status(503).send('fragment from src');
  });
  server.get('/fallback-src', function (request, reply) {
    reply.status(500).send('fragment from fallback_src');
  });
  await server.listen({ port: 3000 });

  // when
  const fragment = await new Include(
    new Map([
      ['src', serverAddress('/src')],
      ['fallback-src', serverAddress('/fallback-src')],
      ['primary', '']
    ])
  ).resolve(config, fragmentCache);

  // then
  expect(fragment.content).toBe('fragment from src');
  expect(fragment.statusCode).toBe(503);
});

test('should reset errored fragment of primary include for consecutive resolving', async () => {
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
  await server.listen({ port: 3000 });
  const include = new Include(
    new Map([
      ['src', serverAddress('/src')],
      ['fallback-src', serverAddress('/fallback-src')],
      ['primary', '']
    ])
  );

  // when
  const fragment = await include.resolve(config, fragmentCache);

  // then
  expect(fragment.content).toBe('fragment from src');
  expect(fragment.statusCode).toBe(503);

  // when
  const fragment2 = await include.resolve(config, fragmentCache);

  // then
  expect(fragment2.content).toBe('fragment from src 2nd call');
  expect(fragment2.statusCode).toBe(504);
});

test('should ignore fallback content and set fragment status code and body of errored src if primary', async () => {
  // given
  server = Fastify();
  server.get('/src', function (request, reply) {
    reply.status(503).send('fragment from src');
  });
  await server.listen({ port: 3000 });

  // when
  const fragment = await new Include(
    new Map([
      ['src', serverAddress('/src')],
      ['primary', '']
    ]),
    'fallback content'
  ).resolve(config, fragmentCache);

  // then
  expect(fragment.content).toBe('fragment from src');
  expect(fragment.statusCode).toBe(503);
});

test('should not follow redirects when resolving URLs', async () => {
  // given
  server = Fastify();
  server.get('/src', function (request, reply) {
    reply.status(302).header('Location', serverAddress('/src-after-redirect')).send();
  });
  server.get('/src-after-redirect', function (request, reply) {
    reply.status(200).send('fragment from src after redirect');
  });
  await server.listen({ port: 3000 });

  // when
  const fragment = await new Include(new Map([['src', serverAddress('/src')]]), 'fallback content').resolve(
    config,
    fragmentCache
  );

  // then
  expect(fragment.content).toBe('fallback content');
});

test.each([
  [new Date(new Date().getTime() + 5000), 'fragment from cache'],
  [new Date(new Date().getTime() - 5000), 'fragment from src']
])('should use cached fragment if not expired', async (expirationTime: Date, expectedFragmentContent: string) => {
  // given
  server = Fastify();
  server.get('/src', function (request, reply) {
    reply.status(200).send('fragment from src');
  });
  await server.listen({ port: 3000 });

  // when
  fragmentCache.set(serverAddress('/src'), new Fragment(200, 'fragment from cache', undefined, expirationTime), {
    ttl: expirationTime.getTime() - new Date().getTime()
  });
  const fragment = await new Include(new Map([['src', serverAddress('/src')]])).resolve(config, fragmentCache);

  // then
  expect(fragment.content).toBe(expectedFragmentContent);
});

test.each([
  [100, 'fragment', false, ':('],
  [200, 'fragment', true, 'fragment'],
  [202, 'fragment', false, ':('],
  [203, 'fragment', true, 'fragment'],
  [204, '', true, ''],
  [205, 'fragment', false, ':('],
  [206, 'fragment', true, 'fragment'],
  [300, 'fragment', true, ':('],
  [302, 'fragment', false, ':('],
  [400, 'fragment', false, ':('],
  [404, 'fragment', true, ':('],
  [405, 'fragment', true, ':('],
  [410, 'fragment', true, ':('],
  [414, 'fragment', true, ':('],
  [500, 'fragment', false, ':('],
  [501, 'fragment', true, ':('],
  [502, 'fragment', false, ':('],
  [503, 'fragment', false, ':('],
  [504, 'fragment', false, ':('],
  [505, 'fragment', false, ':('],
  [506, 'fragment', false, ':('],
  [507, 'fragment', false, ':('],
  [508, 'fragment', false, ':('],
  [509, 'fragment', false, ':('],
  [510, 'fragment', false, ':('],
  [511, 'fragment', false, ':(']
])(
  'should cache fragment if status code is defined as cacheable in RFC 7231 - Status %p',
  async (responseStatus: number, srcFragment: string, expectedFragmentCached: boolean, expectedFragment: string) => {
    // given
    server = Fastify();
    server.get('/src', function (request, reply) {
      reply.status(responseStatus).header('Cache-Control', 'max-age=7200').send(srcFragment);
    });
    await server.listen({ port: 3000 });

    // when
    const fragment = await new Include(new Map([['src', serverAddress('/src')]]), ':(').resolve(config, fragmentCache);

    // then
    expect(fragment.content).toBe(expectedFragment);

    if (expectedFragmentCached) {
      expect(fragmentCache.get(serverAddress('/src'))).toBeDefined();
    } else {
      expect(fragmentCache.get(serverAddress('/src'))).toBeUndefined();
    }
  }
);

test('should apply request timeout', async () => {
  // given
  server = Fastify();
  const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));
  server.get('/src', async function (request, reply) {
    await sleep(2000);
    reply.status(200).send('fragment from src');
  });
  await server.listen({ port: 3000 });

  // when
  const fragment = await new Include(new Map([['src', serverAddress('/src')]]), 'fallback content').resolve(
    config,
    fragmentCache
  );

  // then
  expect(fragment.content).toBe('fallback content');
});
