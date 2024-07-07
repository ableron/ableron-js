import { beforeEach, describe, expect, it } from 'vitest';
import { AbleronConfig } from '../src';
import TransclusionProcessor from '../src/transclusion-processor';
import Fragment from '../src/fragment';
import FragmentCache from '../src/fragment-cache';
import { NoOpLogger } from '../src/logger';

const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));
const fragmentCache = new TransclusionProcessor(
  new AbleronConfig({
    fragmentRequestTimeoutMillis: 1000,
    cacheAutoRefreshEnabled: true
  }),
  new NoOpLogger()
).getFragmentCache();

beforeEach(() => {
  fragmentCache.clear();
});

describe('FragmentCache', () => {
  it('should have limited capacity to prevent out of memory problems', () => {
    // when
    for (let i = 0; i < 1100; i++) {
      fragmentCache.set('fragment-' + i, new Fragment(200, 'fragment', undefined, new Date(Date.now() + 60000)));
    }

    // then
    // @ts-ignore
    expect(fragmentCache.cache.size).toBe(1000);
  });

  it('should not auto refresh fragments if disabled', async () => {
    // given
    const fragmentCache = new TransclusionProcessor(
      new AbleronConfig({
        cacheAutoRefreshEnabled: false
      }),
      new NoOpLogger()
    ).getFragmentCache();
    const newFragment = () => new Fragment(200, 'fragment', undefined, new Date(Date.now() + 1000));
    fragmentCache.set('cacheKey', newFragment(), () => Promise.resolve(newFragment()));

    // when
    await sleep(1200);

    // then
    expect(fragmentCache.get('cacheKey')).toBeUndefined();
  });

  it('should auto refresh fragments if enabled', async () => {
    // given
    const newFragment = () => new Fragment(200, 'fragment', undefined, new Date(Date.now() + 1000));
    fragmentCache.set('cacheKey', newFragment(), () => Promise.resolve(newFragment()));

    // when
    await sleep(1200);

    // then
    expect(fragmentCache.get('cacheKey')).toBeDefined();
  });

  it('should use fragment expiration time as cache entry ttl', async () => {
    // when
    fragmentCache.set('key', new Fragment(200, 'fragment', undefined, new Date(Date.now() + 1000)));

    // then
    expect(fragmentCache.get('key').content).toBe('fragment');

    // and
    await sleep(1010);

    // then
    expect(fragmentCache.get('key')).toBeUndefined();
  });

  it('should not cache expired fragments', async () => {
    // when
    fragmentCache.set('key', new Fragment(200, 'fragment', undefined, new Date()));

    // then
    expect(fragmentCache.get('key')).toBeUndefined();
  });

  it('should clear cache', async () => {
    // given
    const newFragment = () => new Fragment(200, 'fragment', undefined, new Date(Date.now() + 200));
    fragmentCache.set('key', newFragment(), () => Promise.resolve(newFragment()));

    // expect
    expect(fragmentCache.get('key')).toBeDefined();
    await sleep(300);
    expect(fragmentCache.get('key')).toBeDefined();
    fragmentCache.clear();
    expect(fragmentCache.get('key')).toBeUndefined();
    await sleep(300);
    expect(fragmentCache.get('key')).toBeUndefined();
    // @ts-ignore
    expect(fragmentCache.autoRefreshTimers.size).toBe(0);
    // @ts-ignore
    expect(fragmentCache.autoRefreshRetries.size).toBe(0);
  });

  it('should not auto refresh cached fragment when status code is not cacheable', async () => {
    // given
    const newFragment = (status: number) => new Fragment(status, 'fragment', undefined, new Date(Date.now() + 300));
    fragmentCache.set('key', newFragment(200), () => Promise.resolve(newFragment(500)));

    // expect
    expect(fragmentCache.get('key')).toBeDefined();
    await sleep(300);
    expect(fragmentCache.get('key')).toBeUndefined();
    // @ts-ignore
    expect(fragmentCache.autoRefreshTimers.size).toBe(1);
  });

  it('should not auto refresh cached fragment when fragment is marked as not cacheable', async () => {
    // given
    fragmentCache.set('key', new Fragment(200, 'fragment', undefined, new Date(Date.now() + 250)), () =>
      Promise.resolve(new Fragment(200, 'fragment'))
    );

    // expect
    expect(fragmentCache.get('key')).toBeDefined();
    await sleep(300);
    expect(fragmentCache.get('key')).toBeUndefined();
    // @ts-ignore
    expect(fragmentCache.autoRefreshTimers.size).toBe(1);
  });

  it('should continuously refresh cache', async () => {
    // given
    const newFragment = () => new Fragment(200, 'fragment', undefined, new Date(Date.now() + 200));
    fragmentCache.set('key', newFragment(), () => Promise.resolve(newFragment()));

    // expect
    expect(fragmentCache.get('key')).toBeDefined();
    await sleep(250);
    expect(fragmentCache.get('key')).toBeDefined();
    await sleep(250);
    expect(fragmentCache.get('key')).toBeDefined();
    await sleep(250);
    expect(fragmentCache.get('key')).toBeDefined();
  });

  it('should retry to refresh cache on failure with max 3 attempts', { timeout: 10000 }, async () => {
    // given
    let counter = 0;
    const newFragment = () => {
      counter++;

      switch (counter) {
        case 1:
        case 4:
        case 8:
          return new Fragment(200, 'fragment', undefined, new Date(Date.now() + 1000));
        default:
          return null;
      }
    };
    fragmentCache.set('key', newFragment(), () => Promise.resolve(newFragment()));

    // expect
    expect(fragmentCache.get('key')).toBeDefined();
    await sleep(1100);
    expect(fragmentCache.get('key')).toBeUndefined();
    await sleep(1000);
    expect(fragmentCache.get('key')).toBeUndefined();
    await sleep(1000);
    expect(fragmentCache.get('key')).toBeDefined();
    // @ts-ignore
    expect(fragmentCache.autoRefreshRetries.size).toBe(0);

    await sleep(1100);
    expect(fragmentCache.get('key')).toBeUndefined();
    await sleep(1000);
    expect(fragmentCache.get('key')).toBeUndefined();
    await sleep(1000);
    expect(fragmentCache.get('key')).toBeUndefined();
    await sleep(1000);
    expect(fragmentCache.get('key')).toBeUndefined();
    // @ts-ignore
    expect(fragmentCache.autoRefreshRetries.size).toBe(0);
  });
});
