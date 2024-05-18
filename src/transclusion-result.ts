import Include from './include.js';
import Fragment from './fragment.js';
import HttpUtil from './http-util.js';
import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http2';
import { LoggerInterface, NoOpLogger } from './logger.js';

export default class TransclusionResult {
  private content: string;
  private contentExpirationTime?: Date;
  private hasPrimaryInclude: boolean = false;
  private statusCodeOverride?: number;
  private readonly responseHeadersToPass: Headers = new Headers();
  private readonly appendStatsToContent: boolean;
  private readonly exposeFragmentUrl: boolean;
  private processingTimeMillis: number = 0;
  private readonly statMessages: string[] = [];
  private readonly processedIncludes: Include[] = [];
  private readonly logger: LoggerInterface;

  constructor(
    content: string,
    appendStatsToContent: boolean = false,
    exposeFragmentUrl: boolean = false,
    logger?: LoggerInterface
  ) {
    this.logger = logger || new NoOpLogger();
    this.content = content;
    this.appendStatsToContent = appendStatsToContent;
    this.exposeFragmentUrl = exposeFragmentUrl;
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
    return this.processedIncludes.length;
  }

  getProcessingTimeMillis(): number {
    return this.processingTimeMillis;
  }

  setProcessingTimeMillis(processingTimeMillis: number): void {
    this.processingTimeMillis = processingTimeMillis;
  }

  addResolvedInclude(include: Include, fragment: Fragment): void {
    if (include.isPrimary()) {
      if (this.hasPrimaryInclude) {
        this.logger.warn('[Ableron] Only one primary include per page allowed. Multiple found');
        //TODO: Log instead of pushing to stats?
        this.statMessages.push(
          `Ignoring status code and response headers of primary include with status code ${fragment.statusCode} because there is already another primary include`
        );
      } else {
        this.hasPrimaryInclude = true;
        this.statusCodeOverride = fragment.statusCode;
        fragment.responseHeaders.forEach((headerValue, headerName) =>
          this.responseHeadersToPass.set(headerName, headerValue)
        );
        //TODO: Log instead of pushing to stats?
        this.statMessages.push(`Primary include with status code ${fragment.statusCode}`);
      }
    }

    if (this.contentExpirationTime === undefined || fragment.expirationTime < this.contentExpirationTime) {
      this.contentExpirationTime = fragment.expirationTime;
    }

    this.content = this.content.replaceAll(include.getRawIncludeTag(), fragment.content);
    this.processedIncludes.push(include);
    this.statMessages.push(
      `Resolved include '${include.getId()}'` +
        ` with ${this.getFragmentDebugInfo(fragment)}` +
        ` in ${include.getResolveTimeMillis()}ms` +
        (this.exposeFragmentUrl && fragment.url ? '. Fragment-URL: ' + fragment.url : '')
    );
  }

  addUnresolvableInclude(include: Include, errorMessage?: string): void {
    this.content = this.content.replaceAll(include.getRawIncludeTag(), include.getFallbackContent());
    this.contentExpirationTime = new Date(0);
    this.processedIncludes.push(include);
    //TODO
    this.statMessages.push(`Unable to resolve include ${include.getId()}${errorMessage ? ': ' + errorMessage : ''}`);
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
      this.contentExpirationTime === undefined ||
      this.contentExpirationTime < now ||
      pageMaxAgeInSeconds === undefined ||
      pageMaxAgeInSeconds <= 0
    ) {
      return 'no-store';
    }

    if (this.contentExpirationTime < new Date(now.getTime() + pageMaxAgeInSeconds * 1000)) {
      return 'max-age=' + Math.ceil(this.contentExpirationTime.getTime() / 1000 - now.getTime() / 1000);
    }

    return 'max-age=' + pageMaxAgeInSeconds;
  }

  /**
   * Calculates the <code>Cache-Control</code> header value based on the fragment with the lowest
   * expiration time and the given response headers which may contain page expiration time.
   *
   * @return The Cache-Control header value. Either "no-store" or "max-age=xxx"
   */
  calculateCacheControlHeaderValueByResponseHeaders(
    headers: Headers | IncomingHttpHeaders | OutgoingHttpHeaders | { [key: string]: string | string[] | number }
  ) {
    const pageExpirationTime: Date = HttpUtil.calculateResponseExpirationTime(headers);
    const pageMaxAge: number =
      pageExpirationTime > new Date() ? Math.ceil((pageExpirationTime.getTime() - new Date().getTime()) / 1000) : 0;
    return this.calculateCacheControlHeaderValue(pageMaxAge);
  }

  private getFragmentDebugInfo(fragment: Fragment): string {
    if (!fragment.url) {
      return 'fallback content';
    }

    if (fragment.fromCache) {
      return `cached fragment with expiration time ${fragment.expirationTime.toISOString().split('.')[0] + 'Z'}`;
    }

    if (fragment.expirationTime.getTime() == new Date(0).getTime()) {
      return 'uncacheable remote fragment';
    }

    return `remote fragment with cache expiration time ${fragment.expirationTime.toISOString().split('.')[0] + 'Z'}`;
  }

  private getStats(): string {
    let stats = `\n<!-- Ableron stats:\nProcessed ${this.getProcessedIncludesCount()} include(s) in ${this.processingTimeMillis}ms\n`;
    this.statMessages.forEach((logEntry) => (stats += logEntry + '\n'));

    stats += `\n${this.getResolvedIncludesStatsHeader()}\n`;
    this.processedIncludes
      .filter((processedInclude) => processedInclude.isResolved())
      .sort((a, b) => b.getResolveTimeMillis() - a.getResolveTimeMillis())
      .forEach((resolvedInclude) => (stats += this.getResolvedIncludeStatsRow(resolvedInclude) + '\n'));

    return stats + '-->';
  }

  private getResolvedIncludesStatsHeader(): string {
    //TODO: Source, Cache Details
    return 'Time | Include' + (this.exposeFragmentUrl ? ' | Fragment URL' : '');
  }

  private getResolvedIncludeStatsRow(resolvedInclude: Include): string {
    return `${resolvedInclude.getResolveTimeMillis()}ms | ${resolvedInclude.getId()}${this.exposeFragmentUrl ? ' | ' + this.getResolvedIncludeStatsRowFragmentUrl(resolvedInclude) : ''}`;
  }

  private getResolvedIncludeStatsRowFragmentUrl(resolvedInclude: Include): string {
    return resolvedInclude.getResolvedFragment()?.url || '-';
  }

  //TODO
  //TODO
  //TODO
  private buildStatCacheExpiration(cacheExpiration: Date): string {
    if (cacheExpiration.getTime() == new Date(0).getTime()) {
      return 'not cacheable';
    }

    return Math.abs((cacheExpiration.getTime() - new Date().getTime()) / 1000) + 's';
  }
}
