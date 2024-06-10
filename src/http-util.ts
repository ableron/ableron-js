import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http2';
import { LoggerInterface } from './logger';

export default abstract class HttpUtil {
  /**
   * HTTP status codes indicating cacheable responses.
   *
   * @link <a href="https://www.rfc-editor.org/rfc/rfc9110#section-15.1">RFC 9110 Section 15.1. Overview of Status Codes</a>
   */
  public static readonly HTTP_STATUS_CODES_CACHEABLE: number[] = [200, 203, 204, 206, 300, 404, 405, 410, 414, 501];

  private static readonly HEADER_AGE: string = 'Age';
  private static readonly HEADER_CACHE_CONTROL: string = 'Cache-Control';
  private static readonly HEADER_DATE: string = 'Date';
  private static readonly HEADER_EXPIRES: string = 'Expires';

  public static loadUrl(
    url: string,
    requestHeaders: Headers,
    requestTimeoutMillis: number,
    logger?: LoggerInterface
  ): Promise<Response | null> {
    logger && logger.debug(`[Ableron] Loading ${url} with timeout ${requestTimeoutMillis}ms`);

    try {
      requestHeaders.set('Accept-Encoding', 'gzip');

      return fetch(url, {
        headers: requestHeaders,
        redirect: 'manual',
        signal: AbortSignal.timeout(requestTimeoutMillis)
      }).catch((e: Error) => {
        if (e.name === 'TimeoutError') {
          logger && logger.error(`[Ableron] Unable to load ${url}: ${requestTimeoutMillis}ms timeout exceeded`);
        } else {
          logger && logger.error(`[Ableron] Unable to load ${url}: ${e?.message}${e?.cause ? ` (${e?.cause})` : ''}`);
        }

        return null;
      });
    } catch (e) {
      const error: Error = e as Error;
      logger &&
        logger.error(`[Ableron] Unable to load ${url}: ${error.message}${error.cause ? ` (${error.cause})` : ''}`);
      return Promise.resolve(null);
    }
  }

  public static calculateResponseExpirationTime(
    inputHeaders: Headers | IncomingHttpHeaders | OutgoingHttpHeaders | { [key: string]: string | string[] | number }
  ): Date {
    const headers = this.normalizeHeaders(inputHeaders);
    const cacheControlHeaderValue = headers.get(this.HEADER_CACHE_CONTROL);
    const cacheControlDirectives = cacheControlHeaderValue
      ? cacheControlHeaderValue.split(',').map((directive) => directive.trim().toLowerCase())
      : [];
    const cacheLifetimeBySharedCacheMaxAge = this.getCacheLifetimeBySharedCacheMaxAge(cacheControlDirectives);

    if (cacheLifetimeBySharedCacheMaxAge) {
      return cacheLifetimeBySharedCacheMaxAge;
    }

    const cacheLifetimeByMaxAge = this.getCacheLifetimeByMaxAge(cacheControlDirectives, headers.get(this.HEADER_AGE));

    if (cacheLifetimeByMaxAge) {
      return cacheLifetimeByMaxAge;
    }

    const cacheLifetimeByExpires = this.getCacheLifetimeByExpiresHeader(
      headers.get(this.HEADER_EXPIRES),
      headers.get(this.HEADER_DATE)
    );

    if (cacheLifetimeByExpires) {
      return cacheLifetimeByExpires;
    }

    return new Date(0);
  }

  private static getCacheLifetimeBySharedCacheMaxAge(cacheControlDirectives: string[]): Date | null {
    const sharedCacheMaxAgeDirective = cacheControlDirectives.find(
      (directive) => directive.match(/^s-maxage=[1-9][0-9]*$/) != null
    );

    if (sharedCacheMaxAgeDirective) {
      const maxAge = Number(sharedCacheMaxAgeDirective.substring('s-maxage='.length));
      return new Date(Date.now() + maxAge * 1000);
    }

    return null;
  }

  private static getCacheLifetimeByMaxAge(
    cacheControlDirectives: string[],
    ageHeaderValue?: string | null
  ): Date | null {
    const maxAgeDirective = cacheControlDirectives.find(
      (directive) => directive.match(/^max-age=[1-9][0-9]*$/) != null
    );

    if (!maxAgeDirective) {
      return null;
    }

    let maxAge = Number(maxAgeDirective.substring('max-age='.length));

    if (ageHeaderValue) {
      const age = Number(ageHeaderValue);

      if (isNaN(age)) {
        return null;
      }

      maxAge = maxAge - Math.abs(age);
    }

    return new Date(Date.now() + maxAge * 1000);
  }

  private static getCacheLifetimeByExpiresHeader(
    expiresHeaderValue?: string | null,
    dateHeaderValue?: string | null
  ): Date | null {
    if (!expiresHeaderValue) {
      return null;
    }

    let expires = expiresHeaderValue === '0' ? new Date(0) : new Date(expiresHeaderValue);

    if (dateHeaderValue && !isNaN(expires.getTime())) {
      const date = new Date(dateHeaderValue);
      return isNaN(date.getTime()) ? null : new Date(Date.now() + (expires.getTime() - date.getTime()));
    }

    return isNaN(expires.getTime()) ? null : expires;
  }

  static normalizeHeaders(
    headers: Headers | IncomingHttpHeaders | OutgoingHttpHeaders | { [key: string]: string | string[] | number }
  ): Headers {
    if (typeof headers.entries === 'function') {
      return headers as Headers;
    }

    const transformedHeaders = new Headers();

    for (const [name, value] of Object.entries(headers)) {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach((headerValue) => {
            transformedHeaders.append(name, headerValue);
          });
        } else {
          transformedHeaders.set(name, value.toString());
        }
      }
    }

    return transformedHeaders;
  }
}
