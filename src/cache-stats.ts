export default class CacheStats {
  private itemCount: number = 0;
  private hitCount: number = 0;
  private missCount: number = 0;
  private refreshSuccessCount: number = 0;
  private refreshFailureCount: number = 0;

  public getItemCount(): number {
    return this.itemCount;
  }

  public setItemCount(itemCount: number): void {
    this.itemCount = itemCount;
  }

  public getHitCount(): number {
    return this.hitCount;
  }

  public recordHit(): void {
    this.hitCount++;
  }

  public getMissCount(): number {
    return this.missCount;
  }

  public recordMiss(): void {
    this.missCount++;
  }

  public getRefreshSuccessCount(): number {
    return this.refreshSuccessCount;
  }

  public recordRefreshSuccess(): void {
    this.refreshSuccessCount++;
  }

  public getRefreshFailureCount(): number {
    return this.refreshFailureCount;
  }

  public recordRefreshFailure(): void {
    this.refreshFailureCount++;
  }
}
