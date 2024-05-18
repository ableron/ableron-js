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

  addResolvedInclude(include: Include): void {
    //TODO: Create fallback Fragment looks messy
    const fragment = include.getResolvedFragment() || new Fragment(200, '');

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
  }

  addUnresolvableInclude(include: Include, errorMessage?: string): void {
    this.content = this.content.replaceAll(include.getRawIncludeTag(), include.getFallbackContent());
    this.contentExpirationTime = new Date(0);
    //TODO: Add test
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

  private getStats(): string {
    return this.getStatsHeader() + this.getStatsProcessedIncludesDetails() + this.getStatsFooter();
  }

  private getStatsHeader(): string {
    return `\n<!-- Ableron stats:\nProcessed ${this.getProcessedIncludesCount()} include(s) in ${this.processingTimeMillis}ms`;
  }

  private getStatsFooter(): string {
    let statsFooter = '\n';
    this.statMessages.forEach((logEntry) => (statsFooter += '\n' + logEntry));
    return statsFooter + '-->';
  }

  private getStatsProcessedIncludesDetails(): string {
    let stats = '';

    if (this.processedIncludes.length) {
      stats +=
        '\n\nTime | Include | Fragment Source | Cache Details' + (this.exposeFragmentUrl ? ' | Fragment URL' : '');
      this.processedIncludes
        .filter((processedInclude) => processedInclude.isResolved())
        .sort((a, b) => b.getResolveTimeMillis() - a.getResolveTimeMillis())
        .forEach((resolvedInclude) => (stats += '\n' + this.getProcessedIncludeStatsRow(resolvedInclude)));
    }

    return stats;
  }

  private getProcessedIncludeStatsRow(resolvedInclude: Include): string {
    return (
      `${resolvedInclude.getResolveTimeMillis()}ms` +
      ` | ${resolvedInclude.getId()}` +
      ` | ${this.getProcessedIncludeStatsRowFragmentSource(resolvedInclude)}` +
      ` | ${this.getProcessedIncludeStatsRowCacheDetails(resolvedInclude)}` +
      `${this.exposeFragmentUrl ? ' | ' + this.getProcessedIncludeStatsRowFragmentUrl(resolvedInclude) : ''}`
    );
  }

  private getProcessedIncludeStatsRowFragmentSource(resolvedInclude: Include): string {
    return resolvedInclude.getResolvedFragmentSource() || '-';
  }

  private getProcessedIncludeStatsRowCacheDetails(resolvedInclude: Include): string {
    if (!resolvedInclude.getResolvedFragment()?.url) {
      return '-';
    }

    const fragmentCacheExpirationTime = resolvedInclude.getResolvedFragment()?.expirationTime || new Date(0);

    if (fragmentCacheExpirationTime.getTime() == new Date(0).getTime()) {
      return 'not cacheable';
    }

    return (
      'cached - expires in ' + Math.floor((fragmentCacheExpirationTime.getTime() - new Date().getTime()) / 1000) + 's'
    );
  }

  private getProcessedIncludeStatsRowFragmentUrl(resolvedInclude: Include): string {
    return resolvedInclude.getResolvedFragment()?.url || '-';
  }
}
