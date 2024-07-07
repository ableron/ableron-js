import { describe, expect, it } from 'vitest';
import CacheStats from '../src/cache-stats.js';

describe('CacheStats', () => {
  it('should record cache hit', () => {
    // given
    const stats = new CacheStats();

    // expect
    expect(stats.getHitCount()).toBe(0);
    stats.recordHit();
    expect(stats.getHitCount()).toBe(1);
    stats.recordHit();
    expect(stats.getHitCount()).toBe(2);
  });

  it('should record cache miss', () => {
    // given
    const stats = new CacheStats();

    // expect
    expect(stats.getMissCount()).toBe(0);
    stats.recordMiss();
    expect(stats.getMissCount()).toBe(1);
    stats.recordMiss();
    expect(stats.getMissCount()).toBe(2);
  });

  it('should record successful cache refresh', () => {
    // given
    const stats = new CacheStats();

    // expect
    expect(stats.getRefreshSuccessCount()).toBe(0);
    stats.recordRefreshSuccess();
    expect(stats.getRefreshSuccessCount()).toBe(1);
    stats.recordRefreshSuccess();
    expect(stats.getRefreshSuccessCount()).toBe(2);
  });

  it('should record failed cache refresh', () => {
    // given
    const stats = new CacheStats();

    // expect
    expect(stats.getRefreshFailureCount()).toBe(0);
    stats.recordRefreshFailure();
    expect(stats.getRefreshFailureCount()).toBe(1);
    stats.recordRefreshFailure();
    expect(stats.getRefreshFailureCount()).toBe(2);
  });
});
