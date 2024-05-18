import Fragment from './fragment.js';
import * as crypto from 'crypto';
import AbleronConfig from './ableron-config.js';
import HttpUtil from './http-util.js';
import TTLCache from '@isaacs/ttlcache';
import { LoggerInterface, NoOpLogger } from './logger.js';

export default class Include {
  /**
   * Name of the attribute which contains the ID of the include - an optional unique name.
   */
  private readonly ATTR_ID: string = 'id';

  /**
   * Name of the attribute which contains the source URl to resolve the include to.
   */
  private readonly ATTR_SOURCE: string = 'src';

  /**
   * Name of the attribute which contains the timeout for requesting the src URL.
   */
  private readonly ATTR_SOURCE_TIMEOUT_MILLIS: string = 'src-timeout-millis';

  /**
   * Name of the attribute which contains the fallback URL to resolve the include to in case the
   * source URL could not be loaded.
   */
  private readonly ATTR_FALLBACK_SOURCE: string = 'fallback-src';

  /**
   * Name of the attribute which contains the timeout for requesting the fallback-src URL.
   */
  private readonly ATTR_FALLBACK_SOURCE_TIMEOUT_MILLIS: string = 'fallback-src-timeout-millis';

  /**
   * Name of the attribute which denotes a fragment whose response code is set as response code
   * for the page.
   */
  private readonly ATTR_PRIMARY: string = 'primary';

  /**
   * HTTP status codes indicating successful and cacheable responses.
   */
  private readonly HTTP_STATUS_CODES_SUCCESS: number[] = [200, 203, 204, 206];

  /**
   * HTTP status codes indicating cacheable responses.
   *
   * @link <a href="https://www.rfc-editor.org/rfc/rfc9110#section-15.1">RFC 9110 Section 15.1. Overview of Status Codes</a>
   */
  private readonly HTTP_STATUS_CODES_CACHEABLE: number[] = [200, 203, 204, 206, 300, 404, 405, 410, 414, 501];

  private readonly SEVEN_DAYS_IN_MILLISECONDS: number = 7 * 24 * 60 * 60 * 1000;

  private readonly logger: LoggerInterface;

  /**
   * Raw include tag.
   */
  private readonly rawIncludeTag: string;

  /**
   * Raw attributes of the include tag.
   */
  private readonly rawAttributes: Map<string, string>;

  /**
   * Fragment ID. Either generated or passed via attribute.
   */
  private readonly id: string;

  /**
   * URL of the fragment to include.
   */
  private readonly src?: string;

  /**
   * Timeout in milliseconds for requesting the src URL.
   */
  private readonly srcTimeoutMillis?: number;

  /**
   * URL of the fragment to include in case the request to the source URL failed.
   */
  private readonly fallbackSrc?: string;

  /**
   * Timeout in milliseconds for requesting the fallback-src URL.
   */
  private readonly fallbackSrcTimeoutMillis?: number;

  /**
   * Whether the include provides the primary fragment and thus sets the response code of the page.
   */
  private readonly primary: boolean;

  /**
   * Fallback content to use in case the include could not be resolved.
   */
  private readonly fallbackContent: string;

  /**
   * Recorded response of the errored primary fragment.
   */
  private erroredPrimaryFragment: Fragment | null = null;

  private resolved: boolean = false;
  private resolvedFragment?: Fragment;
  private resolveTimeMillis: number = 0;

  constructor(
    rawIncludeTag: string,
    rawAttributes?: Map<string, string>,
    fallbackContent?: string,
    logger?: LoggerInterface
  ) {
    this.logger = logger || new NoOpLogger();
    this.rawIncludeTag = rawIncludeTag;
    this.rawAttributes = rawAttributes !== undefined ? rawAttributes : new Map<string, string>();
    this.id = this.buildIncludeId(this.rawAttributes.get(this.ATTR_ID));
    this.src = this.rawAttributes.get(this.ATTR_SOURCE);
    this.srcTimeoutMillis = this.parseTimeout(this.rawAttributes.get(this.ATTR_SOURCE_TIMEOUT_MILLIS));
    this.fallbackSrc = this.rawAttributes.get(this.ATTR_FALLBACK_SOURCE);
    this.fallbackSrcTimeoutMillis = this.parseTimeout(this.rawAttributes.get(this.ATTR_FALLBACK_SOURCE_TIMEOUT_MILLIS));
    const primary = this.rawAttributes.get(this.ATTR_PRIMARY);
    this.primary = primary !== undefined && ['', 'primary'].includes(primary.toLowerCase());
    this.fallbackContent = fallbackContent !== undefined ? fallbackContent : '';
  }

  getRawIncludeTag(): string {
    return this.rawIncludeTag;
  }

  getRawAttributes(): Map<string, string> {
    return this.rawAttributes;
  }

  getId(): string {
    return this.id;
  }

  getSrc(): string | undefined {
    return this.src;
  }

  getSrcTimeoutMillis(): number | undefined {
    return this.srcTimeoutMillis;
  }

  getFallbackSrc(): string | undefined {
    return this.fallbackSrc;
  }

  getFallbackSrcTimeoutMillis(): number | undefined {
    return this.fallbackSrcTimeoutMillis;
  }

  isPrimary(): boolean {
    return this.primary;
  }

  getFallbackContent(): string {
    return this.fallbackContent;
  }

  isResolved(): boolean {
    return this.resolved;
  }

  getResolveTimeMillis(): number {
    return this.resolveTimeMillis;
  }

  getResolvedFragment(): Fragment | undefined {
    return this.resolvedFragment;
  }

  resolve(
    config: AbleronConfig,
    fragmentCache: TTLCache<string, Fragment>,
    parentRequestHeaders?: Headers
  ): Promise<Fragment> {
    const resolveStartTime = Date.now();
    const fragmentRequestHeaders = this.filterHeaders(
      parentRequestHeaders || new Headers(),
      config.fragmentRequestHeadersToPass.concat(config.fragmentAdditionalRequestHeadersToPass)
    );
    this.erroredPrimaryFragment = null;

    return this.load(
      this.src,
      fragmentRequestHeaders,
      this.getRequestTimeout(this.srcTimeoutMillis, config),
      fragmentCache,
      config
    )
      .then(
        (fragment) =>
          fragment ||
          this.load(
            this.fallbackSrc,
            fragmentRequestHeaders,
            this.getRequestTimeout(this.fallbackSrcTimeoutMillis, config),
            fragmentCache,
            config
          )
      )
      .then((fragment) => fragment || this.erroredPrimaryFragment)
      .then((fragment) => fragment || new Fragment(200, this.fallbackContent))
      .then((fragment) => {
        this.resolveWith(fragment, Date.now() - resolveStartTime);
        return fragment;
      });
  }

  /**
   * Resolved this Include with the given Fragment.
   * @param fragment The Fragment to resolve this Include with
   * @param resolveTimeMillis The time in milliseconds it took to resolve the Include
   */
  resolveWith(fragment: Fragment, resolveTimeMillis?: number): Include {
    this.resolved = true;
    this.resolvedFragment = fragment;
    this.resolveTimeMillis = resolveTimeMillis || 0;
    this.logger.debug('[Ableron] Resolved include %s in %dms', this.id, this.resolveTimeMillis);
    return this;
  }

  private async load(
    url: string | undefined,
    requestHeaders: Headers,
    requestTimeoutMillis: number,
    fragmentCache: TTLCache<string, Fragment>,
    config: AbleronConfig
  ): Promise<Fragment | null> {
    if (!url) {
      return null;
    }

    const fragmentCacheKey = this.buildFragmentCacheKey(url, requestHeaders, config.cacheVaryByRequestHeaders);
    const fragmentFromCache = this.getFragmentFromCache(fragmentCacheKey, fragmentCache);
    const fragment: Promise<Fragment | null> = fragmentFromCache
      ? Promise.resolve(fragmentFromCache)
      : this.requestFragment(url, requestHeaders, requestTimeoutMillis)
          .then(async (response: Response | null) => {
            if (!response) {
              return null;
            }

            const responseBody = await response.text();

            if (!this.HTTP_STATUS_CODES_CACHEABLE.includes(response.status)) {
              this.logger.error(`[Ableron] Fragment ${this.id} returned status code ${response.status}`);
              this.recordErroredPrimaryFragment(
                new Fragment(
                  response.status,
                  responseBody,
                  url,
                  undefined,
                  this.filterHeaders(response.headers, config.primaryFragmentResponseHeadersToPass)
                )
              );
              return null;
            }

            return new Fragment(
              response.status,
              responseBody,
              url,
              HttpUtil.calculateResponseExpirationTime(response.headers),
              this.filterHeaders(response.headers, config.primaryFragmentResponseHeadersToPass)
            );
          })
          .then((fragment) => {
            if (fragment) {
              const fragmentTtl = fragment.expirationTime.getTime() - new Date().getTime();

              if (fragmentTtl > 0) {
                fragmentCache.set(fragmentCacheKey, fragment, {
                  ttl: Math.min(fragmentTtl, this.SEVEN_DAYS_IN_MILLISECONDS)
                });
              }
            }

            return fragment;
          });

    return fragment.then((fragment) => {
      if (fragment && !this.HTTP_STATUS_CODES_SUCCESS.includes(fragment.statusCode)) {
        this.logger.error(`[Ableron] Fragment ${this.id} returned status code ${fragment.statusCode}`);
        this.recordErroredPrimaryFragment(fragment);
        return null;
      }

      return fragment;
    });
  }

  private requestFragment(
    url: string,
    requestHeaders: Headers,
    requestTimeoutMillis: number
  ): Promise<Response | null> {
    this.logger.debug(
      `[Ableron] Loading fragment ${url} for include ${this.id} with timeout ${requestTimeoutMillis}ms`
    );

    try {
      requestHeaders.set('Accept-Encoding', 'gzip');

      return fetch(url, {
        headers: requestHeaders,
        redirect: 'manual',
        signal: AbortSignal.timeout(requestTimeoutMillis)
      }).catch((e: Error) => {
        if (e.name === 'TimeoutError') {
          this.logger.error(
            `[Ableron] Unable to load fragment ${url} for include ${this.id}: ${requestTimeoutMillis}ms timeout exceeded`
          );
        } else {
          this.logger.error(
            `[Ableron] Unable to load fragment ${url} for include ${this.id}: ${e?.message}${e?.cause ? ` (${e?.cause})` : ''}`
          );
        }

        return null;
      });
    } catch (e) {
      const error: Error = e as Error;
      this.logger.error(
        `[Ableron] Unable to load fragment ${url} for include ${this.id}: ${error.message}${
          error.cause ? ` (${error.cause})` : ''
        }`
      );
      return Promise.resolve(null);
    }
  }

  private recordErroredPrimaryFragment(fragment: Fragment): void {
    if (this.primary && this.erroredPrimaryFragment === null) {
      this.erroredPrimaryFragment = fragment;
    }
  }

  private filterHeaders(headersToFilter: Headers, allowedHeaders: string[]): Headers {
    const filteredHeaders = new Headers();
    allowedHeaders.forEach((allowedHeaderName) => {
      if (headersToFilter.has(allowedHeaderName)) {
        filteredHeaders.set(allowedHeaderName, headersToFilter.get(allowedHeaderName) as string);
      }
    });
    return filteredHeaders;
  }

  private parseTimeout(timeoutAsString?: string): number | undefined {
    const parsedTimeout = Number(timeoutAsString);

    if (isNaN(parsedTimeout)) {
      if (timeoutAsString) {
        this.logger.error(`[Ableron] Invalid request timeout: ${timeoutAsString}`);
      }

      return undefined;
    }

    return parsedTimeout;
  }

  private getRequestTimeout(localTimeout: number | undefined, config: AbleronConfig): number {
    return localTimeout ? localTimeout : config.fragmentRequestTimeoutMillis;
  }

  private buildIncludeId(providedId?: string): string {
    if (providedId !== undefined) {
      const sanitizedId = providedId.replaceAll(/[^A-Za-z0-9_-]/g, '');

      if (sanitizedId !== '') {
        return sanitizedId;
      }
    }

    return crypto.createHash('sha1').update(this.rawIncludeTag).digest('hex').substring(0, 7);
  }

  private buildFragmentCacheKey(
    fragmentUrl: string,
    fragmentRequestHeaders: Headers,
    cacheVaryByRequestHeaders: string[]
  ): string {
    let cacheKey = fragmentUrl;
    cacheVaryByRequestHeaders.forEach((headerName) => {
      const headerValue = fragmentRequestHeaders.get(headerName)?.toLowerCase() || null;

      if (headerValue) {
        cacheKey += '|' + headerName.toLowerCase() + '=' + headerValue;
      }
    });
    return cacheKey;
  }

  private getFragmentFromCache(cacheKey: string, fragmentCache: TTLCache<string, Fragment>): Fragment | undefined {
    const fragmentFromCache = fragmentCache.get(cacheKey);

    if (fragmentFromCache) {
      fragmentFromCache.fromCache = true;
    }

    return fragmentFromCache;
  }
}
