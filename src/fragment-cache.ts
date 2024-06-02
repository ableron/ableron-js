import TTLCache from '@isaacs/ttlcache';
import Fragment from './fragment';

export default class FragmentCache {
  private readonly cache: TTLCache<string, Fragment>;
  private readonly autoRefreshFragments: boolean;

  constructor(autoRefreshFragments: boolean = false) {
    this.autoRefreshFragments = autoRefreshFragments;
    this.cache = this.initCache();
  }

  public get(cacheKey: string): Fragment | undefined {
    return this.cache.get(cacheKey);
  }

  public set(cacheKey: string, fragment: Fragment, ttl: number): this {
    this.cache.set(cacheKey, fragment, {
      // Math.min(ttl, 0x7fffffff) assures, that tll fits into a 32-bit signed
      // integer, which is necessary for setTimeout() used internally in cache lib
      ttl: Math.min(ttl, 0x7fffffff)
    });
    return this;
  }

  public clear(): this {
    this.cache.clear();
    return this;
  }

  private initCache(): TTLCache<string, Fragment> {
    return new TTLCache({ max: 1000, ttl: 24 * 60 * 60 * 1000, checkAgeOnGet: false });
  }
}
