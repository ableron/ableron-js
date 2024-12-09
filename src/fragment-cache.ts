import TTLCache from '@isaacs/ttlcache';
import Fragment from './fragment.js';
import { LoggerInterface } from './logger.js';
import { clearTimeout } from 'timers';
import HttpUtil from './http-util.js';
import CacheStats from './cache-stats.js';
import AbleronConfig from './ableron-config';

export default class FragmentCache {
  /**
   * Maximum delay in milliseconds the setTimeout() function can handle.
   * The delay must fit into a 32-bit signed integer, i.e. max=0x7fffffff.
   */
  private static readonly MAX_SET_TIMEOUT_DELAY_MS = 0x7fffffff;
  private readonly logger: LoggerInterface;
  private readonly cache: TTLCache<string, Fragment>;
  private readonly autoRefreshEnabled: boolean;
  private readonly maxRefreshAttempts: number;
  private readonly refreshAttempts: Map<string, number> = new Map();
  private readonly refreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly activeFragments: Set<string> = new Set();
  private readonly inactiveFragmentsMaxRefreshs: number;
  private readonly inactiveFragmentRefreshs: Map<string, number> = new Map();
  private readonly stats: CacheStats = new CacheStats();

  constructor(config: AbleronConfig, logger: LoggerInterface) {
    this.autoRefreshEnabled = config.cacheAutoRefreshEnabled;
    this.maxRefreshAttempts = config.cacheAutoRefreshMaxAttempts;
    this.inactiveFragmentsMaxRefreshs = config.cacheAutoRefreshInactiveFragmentsMaxRefreshs;
    this.logger = logger;
    this.cache = this.initCache(config.cacheMaxItems);
  }

  public get(cacheKey: string): Fragment | undefined {
    const fragmentFromCache = this.cache.get(cacheKey);

    if (fragmentFromCache) {
      this.stats.recordHit();

      if (this.refreshTimers.get(cacheKey)) {
        this.activeFragments.add(cacheKey);
      }
    } else {
      this.stats.recordMiss();
    }

    this.stats.setItemCount(this.cache.size);
    return fragmentFromCache;
  }

  public set(cacheKey: string, fragment: Fragment, autoRefresh?: () => Promise<Fragment | null>): this {
    const fragmentTtl = fragment.expirationTime.getTime() - Date.now();

    if (fragmentTtl > 0) {
      this.cache.set(cacheKey, fragment, {
        // Math.min(ttl, 0x7fffffff) assures, that tll fits into a 32-bit signed
        // integer, which is necessary for setTimeout() used internally in cache lib
        ttl: Math.min(fragmentTtl, FragmentCache.MAX_SET_TIMEOUT_DELAY_MS)
      });

      if (this.autoRefreshEnabled && autoRefresh) {
        this.registerAutoRefresh(cacheKey, autoRefresh, this.calculateFragmentRefreshDelay(fragmentTtl));
      }
    }

    return this;
  }

  public clear(): this {
    this.refreshTimers.forEach((value) => clearTimeout(value));
    this.refreshTimers.clear();
    this.refreshAttempts.clear();
    this.activeFragments.clear();
    this.inactiveFragmentRefreshs.clear();
    this.cache.clear();
    return this;
  }

  public getStats(): CacheStats {
    return this.stats;
  }

  private registerAutoRefresh(
    cacheKey: string,
    autoRefresh: () => Promise<Fragment | null>,
    refreshDelayMs: number
  ): void {
    this.refreshTimers.set(
      cacheKey,
      setTimeout(async () => {
        this.refreshTimers.delete(cacheKey);

        if (this.shouldPerformAutoRefresh(cacheKey)) {
          try {
            const fragment = await autoRefresh();

            if (this.isFragmentCacheable(fragment)) {
              const oldCacheEntry = this.cache.get(cacheKey);
              this.set(cacheKey, fragment!, autoRefresh);
              this.handleSuccessfulCacheRefresh(cacheKey, oldCacheEntry);
            } else {
              this.handleFailedCacheRefreshAttempt(cacheKey, autoRefresh);
            }
          } catch (e: any) {
            this.logger.error(`[Ableron] Unable to refresh cached fragment '${cacheKey}': ${e.stack || e.message}`);
            this.handleFailedCacheRefreshAttempt(cacheKey, autoRefresh);
          }
        } else {
          this.inactiveFragmentRefreshs.delete(cacheKey);
          this.logger.debug(`[Ableron] Stopping auto refresh of fragment '${cacheKey}': Inactive fragment`);
        }
      }, refreshDelayMs).unref()
    );
  }

  private calculateFragmentRefreshDelay(fragmentTtl: number): number {
    return Math.max(Math.min(fragmentTtl * 0.85, FragmentCache.MAX_SET_TIMEOUT_DELAY_MS), 10);
  }

  private shouldPerformAutoRefresh(cacheKey: string): boolean {
    return (
      this.activeFragments.has(cacheKey) ||
      (this.inactiveFragmentRefreshs.get(cacheKey) || 0) < this.inactiveFragmentsMaxRefreshs
    );
  }

  private isFragmentCacheable(fragment?: Fragment | null): boolean {
    return (
      fragment != null &&
      HttpUtil.HTTP_STATUS_CODES_CACHEABLE.includes(fragment.statusCode) &&
      fragment.expirationTime > new Date()
    );
  }

  private handleSuccessfulCacheRefresh(cacheKey: string, oldCacheEntry?: Fragment): void {
    this.refreshAttempts.delete(cacheKey);

    if (this.activeFragments.has(cacheKey)) {
      this.activeFragments.delete(cacheKey);
      this.inactiveFragmentRefreshs.delete(cacheKey);
    } else {
      this.inactiveFragmentRefreshs.set(cacheKey, (this.inactiveFragmentRefreshs.get(cacheKey) ?? 0) + 1);
    }

    this.stats.recordRefreshSuccess();
    this.logger.debug(
      oldCacheEntry
        ? `[Ableron] Refreshed cached fragment '${cacheKey}' ${oldCacheEntry.expirationTime.getTime() - Date.now()}ms before expiration`
        : `[Ableron] Refreshed expired cached fragment '${cacheKey}'`
    );
  }

  private handleFailedCacheRefreshAttempt(cacheKey: string, autoRefresh: () => Promise<Fragment | null>): void {
    const attempts = (this.refreshAttempts.get(cacheKey) ?? 0) + 1;
    this.stats.recordRefreshFailure();

    if (attempts < this.maxRefreshAttempts) {
      this.logger.error(
        `[Ableron] Unable to refresh cached fragment '${cacheKey}': Attempt #${attempts} failed. Retry in 1s`
      );
      this.refreshAttempts.set(cacheKey, attempts);
      this.registerAutoRefresh(cacheKey, autoRefresh, 1000);
    } else {
      this.logger.error(
        `[Ableron] Unable to refresh cached fragment '${cacheKey}' after ${this.maxRefreshAttempts} attempts. Stopping auto refresh`
      );
      this.refreshAttempts.delete(cacheKey);
      this.activeFragments.delete(cacheKey);
      this.inactiveFragmentRefreshs.delete(cacheKey);
    }
  }

  private initCache(maxItemCount: number): TTLCache<string, Fragment> {
    return new TTLCache({ max: maxItemCount, checkAgeOnGet: false });
  }
}
