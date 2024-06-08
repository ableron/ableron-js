import TTLCache from '@isaacs/ttlcache';
import Fragment from './fragment';
import { LoggerInterface } from './logger';
import { clearTimeout } from 'timers';
import HttpUtil from './http-util';

export default class FragmentCache {
  /**
   * Maximum delay in milliseconds the setTimeout() function can handle.
   * The delay must fit into a 32-bit signed integer, i.e. max=0x7fffffff.
   */
  private static readonly MAX_SET_TIMEOUT_DELAY_MS = 0x7fffffff;
  private readonly logger: LoggerInterface;
  private readonly cache: TTLCache<string, Fragment>;
  private readonly autoRefreshFragments: boolean;
  private readonly autoRefreshTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(autoRefreshFragments: boolean, logger: LoggerInterface) {
    this.autoRefreshFragments = autoRefreshFragments;
    this.logger = logger;
    this.cache = this.initCache();
  }

  public get(cacheKey: string): Fragment | undefined {
    return this.cache.get(cacheKey);
  }

  public set(cacheKey: string, fragment: Fragment, autoRefresh?: () => Promise<Fragment | null>): this {
    const fragmentTtl = fragment.expirationTime.getTime() - Date.now();

    if (fragmentTtl > 0) {
      this.cache.set(cacheKey, fragment, {
        // Math.min(ttl, 0x7fffffff) assures, that tll fits into a 32-bit signed
        // integer, which is necessary for setTimeout() used internally in cache lib
        ttl: Math.min(fragmentTtl, FragmentCache.MAX_SET_TIMEOUT_DELAY_MS)
      });

      if (this.autoRefreshFragments && autoRefresh) {
        this.registerAutoRefresh(cacheKey, autoRefresh, this.calculateFragmentRefreshDelay(fragmentTtl));
      }
    }

    return this;
  }

  public clear(): this {
    this.autoRefreshTimers.forEach((value, key, map) => clearTimeout(value));
    this.autoRefreshTimers.clear();
    this.cache.clear();
    return this;
  }

  private registerAutoRefresh(
    cacheKey: string,
    autoRefresh: () => Promise<Fragment | null>,
    refreshDelayMs: number
  ): void {
    this.autoRefreshTimers.set(
      cacheKey,
      setTimeout(() => {
        autoRefresh().then((fragment) => {
          this.autoRefreshTimers.delete(cacheKey);

          if (!fragment) {
            this.logger.error(`[Ableron] Unable to refresh cache entry ${cacheKey}: Retry in 1s`);
            this.registerAutoRefresh(cacheKey, autoRefresh, 1000);
            return null;
          }

          if (!HttpUtil.HTTP_STATUS_CODES_CACHEABLE.includes(fragment.statusCode)) {
            this.logger.error(`[Ableron] Unable to refresh cache entry ${cacheKey}: Status ${fragment.statusCode}`);
            return null;
          }

          const oldCacheEntry = this.get(cacheKey);
          this.set(cacheKey, fragment, autoRefresh);
          this.logger.debug(
            `[Ableron] Refreshed cache entry ${cacheKey} ${
              oldCacheEntry
                ? oldCacheEntry.expirationTime.getTime() - new Date().getTime() + 'ms before expiration'
                : 'which was already expired'
            }. Refresh was triggered after ${refreshDelayMs}ms`
          );
        });
      }, refreshDelayMs)
    );
  }

  private calculateFragmentRefreshDelay(fragmentTtl: number): number {
    return Math.max(Math.min(fragmentTtl * 0.85, FragmentCache.MAX_SET_TIMEOUT_DELAY_MS), 10);
  }

  private initCache(): TTLCache<string, Fragment> {
    return new TTLCache({ max: 1000, ttl: 24 * 60 * 60 * 1000, checkAgeOnGet: false });
  }
}
