import { Fragment } from './fragment';
import * as crypto from 'crypto';
import { AbleronConfig } from './ableron-config';
import { LRUCache } from 'lru-cache';
import { HttpUtil } from './http-util';

export class Include {
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
  private readonly src: string | undefined;

  /**
   * Timeout in milliseconds for requesting the src URL.
   */
  private readonly srcTimeoutMillis: number | undefined;

  /**
   * URL of the fragment to include in case the request to the source URL failed.
   */
  private readonly fallbackSrc: string | undefined;

  /**
   * Timeout in milliseconds for requesting the fallback-src URL.
   */
  private readonly fallbackSrcTimeoutMillis: number | undefined;

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

  /**
   * Constructs a new Include.
   *
   * @param rawAttributes Raw attributes of the include tag
   * @param fallbackContent Fallback content to use in case the include could not be resolved
   * @param rawIncludeTag Raw include tag
   */
  constructor(rawAttributes?: Map<string, string>, fallbackContent?: string, rawIncludeTag?: string) {
    this.rawIncludeTag = rawIncludeTag !== undefined ? rawIncludeTag : '';
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

  resolve(config: AbleronConfig, fragmentCache: LRUCache<string, Fragment>): Promise<Fragment> {
    this.erroredPrimaryFragment = null;

    return this.load(this.src, this.getRequestTimeout(this.srcTimeoutMillis, config), fragmentCache)
      .then((fragment) =>
        fragment === null
          ? this.load(this.fallbackSrc, this.getRequestTimeout(this.fallbackSrcTimeoutMillis, config), fragmentCache)
          : fragment
      )
      .then((fragment) => (fragment === null && this.erroredPrimaryFragment ? this.erroredPrimaryFragment : fragment))
      .then((fragment) => (fragment === null ? new Fragment(200, this.fallbackContent) : fragment));
  }

  private load(
    url: string | undefined,
    requestTimeoutMillis: number,
    fragmentCache: LRUCache<string, Fragment>
  ): Promise<Fragment | null> {
    if (url === undefined) {
      return Promise.resolve(null);
    }

    const foundFragment: Promise<Fragment | null> = fragmentCache.has(url)
      ? Promise.resolve(fragmentCache.get(url) as Fragment)
      : this.performRequest(url, requestTimeoutMillis).then(async (response) => {
          if (!response) {
            return null;
          }

          const responseBody = await response.text();

          if (!this.HTTP_STATUS_CODES_CACHEABLE.includes(response.status)) {
            console.error(`Fragment ${this.id} returned status code ${response.status}`);
            this.recordErroredPrimaryFragment(new Fragment(response.status, responseBody, url));
            return null;
          }

          const fragmentExpirationTime = HttpUtil.calculateResponseExpirationTime(response.headers);
          const fragment = new Fragment(response.status, responseBody, url, fragmentExpirationTime);
          const fragmentTtl = fragmentExpirationTime.getTime() - new Date().getTime();

          if (fragmentTtl > 0) {
            fragmentCache.set(url, fragment, { ttl: fragmentTtl });
          }

          return fragment;
        });

    return foundFragment.then((fragment) => {
      if (!fragment) {
        return null;
      }

      if (!this.HTTP_STATUS_CODES_SUCCESS.includes(fragment.statusCode)) {
        console.error(`Fragment ${this.id} returned status code ${fragment.statusCode}`);
        this.recordErroredPrimaryFragment(fragment);
        return null;
      }

      return fragment;
    });
  }

  private performRequest(url: string, requestTimeoutMillis: number): Promise<Response | null> {
    console.debug(`Loading fragment ${url} for include ${this.id} with timeout ${requestTimeoutMillis}ms`);

    try {
      return fetch(new Request(url, { redirect: 'error' }), {
        signal: AbortSignal.timeout(requestTimeoutMillis)
      }).catch((e: Error) => {
        if (e.name === 'TimeoutError') {
          console.error(
            `Unable to load fragment ${url} for include ${this.id}: ${requestTimeoutMillis}ms timeout exceeded`
          );
        } else {
          console.error(
            `Unable to load fragment ${url} for include ${this.id}: ${e?.message}${e?.cause ? ` (${e?.cause})` : ''}`
          );
        }

        return null;
      });
    } catch (e) {
      const error: Error = e as Error;
      console.error(
        `Unable to load fragment ${url} for include ${this.id}: ${error.message}${
          error.cause ? ` (${error.cause})` : ''
        }`
      );
      return Promise.resolve(null);
    }
  }

  private recordErroredPrimaryFragment(fragment: Fragment) {
    if (this.primary && this.erroredPrimaryFragment === null) {
      this.erroredPrimaryFragment = fragment;
    }
  }

  private parseTimeout(timeoutAsString?: string): number | undefined {
    if (timeoutAsString === undefined) {
      return undefined;
    }

    const parsedTimeout = Number(timeoutAsString);

    if (isNaN(parsedTimeout)) {
      console.error(`Invalid request timeout: ${timeoutAsString}`);
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
}
