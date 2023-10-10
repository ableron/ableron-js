import { Include } from './include';
import { Fragment } from './fragment';
import { HttpUtil } from './http-util';

export class TransclusionResult {
  private content: string;
  private contentExpirationTime: Date | undefined;
  private hasPrimaryInclude: boolean = false;
  private statusCodeOverride: number | undefined;
  private readonly responseHeadersToPass: Headers = new Headers();
  private readonly appendStatsToContent: boolean;
  private processedIncludesCount: number = 0;
  private processingTimeMillis: number = 0;
  private readonly resolvedIncludesLog: string[] = [];

  constructor(content: string, appendStatsToContent: boolean = false) {
    this.content = content;
    this.appendStatsToContent = appendStatsToContent;
  }

  getContent(): string {
    return this.appendStatsToContent ? this.content + this.getStats() : this.content;
  }

  getContentExpirationTime(): Date | undefined {
    return this.contentExpirationTime;
  }

  getHasPrimaryInclude(): boolean {
    return this.hasPrimaryInclude;
  }

  getStatusCodeOverride(): number | undefined {
    return this.statusCodeOverride;
  }

  getResponseHeadersToPass(): Headers {
    return this.responseHeadersToPass;
  }

  getProcessedIncludesCount(): number {
    return this.processedIncludesCount;
  }

  getProcessingTimeMillis(): number {
    return this.processingTimeMillis;
  }

  setProcessingTimeMillis(processingTimeMillis: number): void {
    this.processingTimeMillis = processingTimeMillis;
  }

  addResolvedInclude(include: Include, fragment: Fragment, includeResolveTimeMillis: number): void {
    if (include.isPrimary()) {
      if (this.hasPrimaryInclude) {
        console.warn('Only one primary include per page allowed. Multiple found');
        this.resolvedIncludesLog.push(
          `Ignoring primary include with status code ${fragment.statusCode} because there is already another primary include`
        );
      } else {
        this.hasPrimaryInclude = true;
        this.statusCodeOverride = fragment.statusCode;
        fragment.responseHeaders.forEach((headerValue, headerName) =>
          this.responseHeadersToPass.set(headerName, headerValue)
        );
        this.resolvedIncludesLog.push(`Primary include with status code ${fragment.statusCode}`);
      }
    }

    if (this.contentExpirationTime === undefined || fragment.expirationTime < this.contentExpirationTime) {
      this.contentExpirationTime = fragment.expirationTime;
    }

    this.content = this.content.replace(include.getRawIncludeTag(), fragment.content);
    this.processedIncludesCount++;
    this.resolvedIncludesLog.push(
      `Resolved include ${include.getId()} with ${this.getFragmentDebugInfo(fragment)} in ${includeResolveTimeMillis}ms`
    );
  }

  /**
   * Calculates the <code>Cache-Control</code> header value based on the fragment with the lowest
   * expiration time and the given page max age.
   *
   * @return The Cache-Control header value. Either "no-store" or "max-age=xxx"
   */
  calculateCacheControlHeaderValue(pageMaxAgeInSeconds?: number) {
    const now = new Date();

    if (
      this.contentExpirationTime == undefined ||
      this.contentExpirationTime < now ||
      pageMaxAgeInSeconds === undefined ||
      pageMaxAgeInSeconds <= 0
    ) {
      return 'no-store';
    }

    if (this.contentExpirationTime < new Date(now.getTime() + pageMaxAgeInSeconds * 1000)) {
      return `max-age=${Math.ceil((this.contentExpirationTime.getTime() - now.getTime()) / 1000)}`;
    }

    return 'max-age=' + pageMaxAgeInSeconds;
  }

  /**
   * Calculates the <code>Cache-Control</code> header value based on the fragment with the lowest
   * expiration time and the given response headers which may contain page expiration time.
   *
   * @return The Cache-Control header value. Either "no-store" or "max-age=xxx"
   */
  calculateCacheControlHeaderValueByResponseHeaders(headers: Headers) {
    const pageExpirationTime: Date = HttpUtil.calculateResponseExpirationTime(headers);
    const pageMaxAge: number =
      pageExpirationTime > new Date() ? Math.ceil((pageExpirationTime.getTime() - new Date().getTime()) / 1000) : 0;
    return this.calculateCacheControlHeaderValue(pageMaxAge);
  }

  private getFragmentDebugInfo(fragment: Fragment): string {
    if (!fragment.isRemote) {
      return 'fallback content';
    }

    if (fragment.expirationTime.getTime() == new Date(0).getTime()) {
      return 'uncacheable remote fragment';
    }

    return `remote fragment with cache expiration time ${fragment.expirationTime.toISOString().split('.')[0] + 'Z'}`;
  }

  private getStats(): string {
    let stats = `\n<!-- Ableron stats:\nProcessed ${this.processedIncludesCount} include(s) in ${this.processingTimeMillis}ms\n`;
    this.resolvedIncludesLog.forEach((logEntry) => (stats = stats + logEntry + '\n'));
    return stats + '-->';
  }
}
