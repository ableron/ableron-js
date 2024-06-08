import { beforeEach, describe, expect, it } from 'vitest';
import { AbleronConfig } from '../src';
import TransclusionProcessor from '../src/transclusion-processor';
import Fragment from '../src/fragment';
import FragmentCache from '../src/fragment-cache';

const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));
const config = new AbleronConfig({
  fragmentRequestTimeoutMillis: 1000,
  cacheAutoRefreshFragments: true
});
const fragmentCache = new TransclusionProcessor(config, console).getFragmentCache();

beforeEach(() => {
  fragmentCache.clear();
});

describe('FragmentCache', () => {
  it('should have limited capacity to prevent out of memory problems', () => {
    // when
    for (let i = 0; i < 1100; i++) {
      fragmentCache.set(
        'fragment-' + i,
        new Fragment(200, 'fragment', undefined, new Date(new Date().getTime() + 60000))
      );
    }

    //then
    // @ts-ignore
    expect(fragmentCache.cache.size).toBe(1000);
  });

  it('should not auto refresh fragments if disabled', async () => {
    // given
    const fragmentCache = new TransclusionProcessor(
      new AbleronConfig({
        cacheAutoRefreshFragments: false
      }),
      console
    ).getFragmentCache();
    const newFragment = () => new Fragment(200, 'fragment', undefined, new Date(new Date().getTime() + 1000));
    fragmentCache.set('cacheKey', newFragment(), () => Promise.resolve(newFragment()));

    // when
    await sleep(1200);

    // then
    expect(fragmentCache.get('cacheKey')).toBeUndefined();
  });

  it('should auto refresh fragments if enabled', async () => {
    // given
    const fragmentCache = new TransclusionProcessor(
      new AbleronConfig({
        cacheAutoRefreshFragments: true
      }),
      console
    ).getFragmentCache();
    const newFragment = () => new Fragment(200, 'fragment', undefined, new Date(new Date().getTime() + 1000));
    fragmentCache.set('cacheKey', newFragment(), () => Promise.resolve(newFragment()));

    // when
    await sleep(1200);

    // then
    expect(fragmentCache.get('cacheKey')).toBeDefined();
  });

  it('should use fragment expiration time as cache entry ttl', async () => {
    // when
    fragmentCache.set('key', new Fragment(200, 'fragment', undefined, new Date(new Date().getTime() + 1000)));

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
});
