export default class Stats {
  private totalCacheHits: number = 0;
  private totalCacheMisses: number = 0;

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
}
