export default class CacheStats {
  private totalCacheHits: number = 0;
  private totalCacheMisses: number = 0;
  private totalSuccessfulCacheRefreshs: number = 0;
  private totalFailedCacheRefreshs: number = 0;

  public getTotalCacheHits(): number {
    return this.totalCacheHits;
  }

  public recordCacheHit(): void {
    this.totalCacheHits++;
  }

  public getTotalCacheMisses(): number {
    return this.totalCacheMisses;
  }

  public recordCacheMiss(): void {
    this.totalCacheMisses++;
  }

  public getTotalSuccessfulCacheRefreshs(): number {
    return this.totalSuccessfulCacheRefreshs;
  }

  public recordSuccessfulCacheRefresh(): void {
    this.totalSuccessfulCacheRefreshs++;
  }

  public getTotalFailedCacheRefreshs(): number {
    return this.totalFailedCacheRefreshs;
  }

  public recordFailedCacheRefresh(): void {
    this.totalFailedCacheRefreshs++;
  }
}
