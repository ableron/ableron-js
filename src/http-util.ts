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
      return new Date(new Date().getTime() + maxAge * 1000);
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

    return new Date(new Date().getTime() + maxAge * 1000);
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
      return isNaN(date.getTime()) ? null : new Date(new Date().getTime() + (expires.getTime() - date.getTime()));
    }

    console.log('Expires: ' + expires.getTime());

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
