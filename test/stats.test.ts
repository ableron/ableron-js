import { describe, expect, it } from 'vitest';
import Stats from '../src/stats.js';

describe('Stats', () => {
  it('should record cache hit', () => {
    // given
    const stats = new Stats();

    // expect
    expect(stats.getTotalCacheHits()).toBe(0);
    stats.recordCacheHit();
    expect(stats.getTotalCacheHits()).toBe(1);
    stats.recordCacheHit();
    expect(stats.getTotalCacheHits()).toBe(2);
  });

  it('should record cache miss', () => {
    // given
    const stats = new Stats();

    // expect
    expect(stats.getTotalCacheMisses()).toBe(0);
    stats.recordCacheMiss();
    expect(stats.getTotalCacheMisses()).toBe(1);
    stats.recordCacheMiss();
    expect(stats.getTotalCacheMisses()).toBe(2);
  });
});
