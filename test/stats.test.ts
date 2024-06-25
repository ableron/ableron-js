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

  it('should record successful cache refresh', () => {
    // given
    const stats = new Stats();

    // expect
    expect(stats.getTotalSuccessfulCacheRefreshs()).toBe(0);
    stats.recordSuccessfulCacheRefresh();
    expect(stats.getTotalSuccessfulCacheRefreshs()).toBe(1);
    stats.recordSuccessfulCacheRefresh();
    expect(stats.getTotalSuccessfulCacheRefreshs()).toBe(2);
  });

  it('should record failed cache refresh', () => {
    // given
    const stats = new Stats();

    // expect
    expect(stats.getTotalFailedCacheRefreshs()).toBe(0);
    stats.recordFailedCacheRefresh();
    expect(stats.getTotalFailedCacheRefreshs()).toBe(1);
    stats.recordFailedCacheRefresh();
    expect(stats.getTotalFailedCacheRefreshs()).toBe(2);
  });
});
