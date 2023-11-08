import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http2';

export default class HttpUtil {
  private static HEADER_AGE: string = 'Age';
  private static HEADER_CACHE_CONTROL: string = 'Cache-Control';
  private static HEADER_DATE: string = 'Date';
  private static HEADER_EXPIRES: string = 'Expires';

  static calculateResponseExpirationTime(
    inputHeaders: Headers | IncomingHttpHeaders | OutgoingHttpHeaders | { [key: string]: string | string[] | number }
  ): Date {
    const headers = this.normalizeHeaders(inputHeaders);
    const cacheControlHeaderValue = headers.get(this.HEADER_CACHE_CONTROL);
    const cacheControlDirectives =
      cacheControlHeaderValue !== null
        ? cacheControlHeaderValue.split(',').map((directive) => directive.trim().toLowerCase())
        : [];
    const cacheLifetimeBySharedCacheMaxAge = this.getCacheLifetimeBySharedCacheMaxAge(cacheControlDirectives);

    if (cacheLifetimeBySharedCacheMaxAge !== undefined) {
      return cacheLifetimeBySharedCacheMaxAge;
    }

    const ageHeaderValue = headers.get(this.HEADER_AGE);
    const cacheLifetimeByMaxAge = this.getCacheLifetimeByMaxAge(
      cacheControlDirectives,
      ageHeaderValue !== null ? ageHeaderValue : undefined
    );

    if (cacheLifetimeByMaxAge !== undefined) {
      return cacheLifetimeByMaxAge;
    }

    const expiresHeaderValue = headers.get(this.HEADER_EXPIRES);
    const dateHeaderValue = headers.get(this.HEADER_DATE);
    const cacheLifetimeByExpires = this.getCacheLifetimeByExpiresHeader(
      expiresHeaderValue !== null ? expiresHeaderValue : undefined,
      dateHeaderValue !== null ? dateHeaderValue : undefined
    );

    if (cacheLifetimeByExpires !== undefined) {
      return cacheLifetimeByExpires;
    }

    return new Date(0);
  }

  private static getCacheLifetimeBySharedCacheMaxAge(cacheControlDirectives: string[]): Date | undefined {
    const sharedCacheMaxAgeDirective = cacheControlDirectives.find(
      (directive) => directive.match(/^s-maxage=[1-9][0-9]*$/) != null
    );

    if (sharedCacheMaxAgeDirective !== undefined) {
      const maxAge = Number(sharedCacheMaxAgeDirective.substring('s-maxage='.length));
      return new Date(new Date().getTime() + maxAge * 1000);
    }

    return undefined;
  }

  private static getCacheLifetimeByMaxAge(cacheControlDirectives: string[], ageHeaderValue?: string): Date | undefined {
    const maxAgeDirective = cacheControlDirectives.find(
      (directive) => directive.match(/^max-age=[1-9][0-9]*$/) != null
    );

    if (maxAgeDirective === undefined) {
      return undefined;
    }

    let maxAge = Number(maxAgeDirective.substring('max-age='.length));

    if (ageHeaderValue !== undefined) {
      const age = Number(ageHeaderValue);

      if (isNaN(age)) {
        return undefined;
      }

      maxAge = maxAge - Math.abs(age);
    }

    return new Date(new Date().getTime() + maxAge * 1000);
  }

  private static getCacheLifetimeByExpiresHeader(
    expiresHeaderValue?: string,
    dateHeaderValue?: string
  ): Date | undefined {
    if (expiresHeaderValue === undefined) {
      return undefined;
    }

    let expires = expiresHeaderValue === '0' ? new Date(0) : new Date(expiresHeaderValue);

    if (dateHeaderValue !== undefined && !isNaN(expires.getTime())) {
      const date = new Date(dateHeaderValue);
      return isNaN(date.getTime()) ? undefined : new Date(new Date().getTime() + (expires.getTime() - date.getTime()));
    }

    return isNaN(expires.getTime()) ? undefined : expires;
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
