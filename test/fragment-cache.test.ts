import { describe, expect, it } from 'vitest';
import { AbleronConfig } from '../src';
import TransclusionProcessor from '../src/transclusion-processor';
import Fragment from '../src/fragment';

const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));
const config = new AbleronConfig({
  fragmentRequestTimeoutMillis: 1000,
  cacheAutoRefreshFragments: true
});
const fragmentCache = new TransclusionProcessor(config, console).getFragmentCache();

describe('FragmentCache', () => {
  it('should have maximum capacity of 1000 fragments', () => {
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
});
