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
  private readonly autoRefreshEnabled: boolean;
  private readonly autoRefreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly autoRefreshRetries: Map<string, number> = new Map();
  private readonly autoRefreshMaxRetries: number = 3;

  constructor(autoRefreshEnabled: boolean, logger: LoggerInterface) {
    this.autoRefreshEnabled = autoRefreshEnabled;
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

      if (this.autoRefreshEnabled && autoRefresh) {
        this.registerAutoRefresh(cacheKey, autoRefresh, this.calculateFragmentRefreshDelay(fragmentTtl));
      }
    }

    return this;
  }

  public clear(): this {
    this.autoRefreshTimers.forEach((value) => clearTimeout(value));
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

          if (this.isFragmentCacheable(fragment)) {
            const oldCacheEntry = this.get(cacheKey);
            this.set(cacheKey, fragment!, autoRefresh);
            this.handleSuccessfulCacheRefresh(cacheKey, oldCacheEntry);
          } else {
            this.handleFailedCacheRefreshAttempt(cacheKey, autoRefresh);
            this.handleFailedCacheRefreshAttempt(cacheKey, autoRefresh);
          }
        });
      }, refreshDelayMs)
    );
  }

  private calculateFragmentRefreshDelay(fragmentTtl: number): number {
    return Math.max(Math.min(fragmentTtl * 0.85, FragmentCache.MAX_SET_TIMEOUT_DELAY_MS), 10);
  }

  private isFragmentCacheable(fragment?: Fragment | null): boolean {
    return (
      fragment != null &&
      HttpUtil.HTTP_STATUS_CODES_CACHEABLE.includes(fragment.statusCode) &&
      fragment.expirationTime > new Date()
    );
  }

  private handleFailedCacheRefreshAttempt(cacheKey: string, autoRefresh: () => Promise<Fragment | null>): void {
    const retryCount = (this.autoRefreshRetries.get(cacheKey) ?? 0) + 1;
    this.autoRefreshRetries.set(cacheKey, retryCount);

    if (retryCount < this.autoRefreshMaxRetries) {
      this.logger.error(`[Ableron] Unable to refresh cache entry ${cacheKey}: Retry in 1s`);
      this.registerAutoRefresh(cacheKey, autoRefresh, 1000);
    } else {
      this.logger.error(
        `[Ableron] Unable to refresh cache entry ${cacheKey}. ${this.autoRefreshMaxRetries} consecutive attempts failed`
      );
      this.autoRefreshRetries.delete(cacheKey);
    }
  }

  private handleSuccessfulCacheRefresh(cacheKey: string, oldCacheEntry?: Fragment): void {
    this.autoRefreshRetries.delete(cacheKey);

    if (oldCacheEntry) {
      this.logger.debug(
        `[Ableron] Refreshed cache entry ${cacheKey} ${oldCacheEntry.expirationTime.getTime() - Date.now()}ms before expiration`
      );
    } else {
      this.logger.debug(`[Ableron] Refreshed already expired cache entry ${cacheKey} via auto refresh`);
    }
  }

  private initCache(): TTLCache<string, Fragment> {
    return new TTLCache({ max: 1000, checkAgeOnGet: false });
  }
}
