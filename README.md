# @ableron/ableron

[![Build Status](https://github.com/ableron/ableron-js/actions/workflows/test.yml/badge.svg)](https://github.com/ableron/ableron-js/actions/workflows/test.yml)
[![npm version](https://badge.fury.io/js/@ableron%2Fableron.svg)](https://badge.fury.io/js/@ableron%2Fableron)
[![Node.js Version](https://img.shields.io/badge/Node.js-18+-4EB1BA.svg)](https://nodejs.org/docs/latest-v18.x/api/)

JavaScript Library for Ableron Server Side UI Composition.

## Installation

```shell
npm i @ableron/ableron
```

## Usage

Normally, you do not want to use `ableron-js` directly, because intercepting and modifying
the response body within your service may be tricky. Instead, you may want to use an existing
framework integration, which uses `ableron-js` under the hood, e.g.

- [ableron-express](https://github.com/ableron/ableron-express)
- [ableron-fastify](https://github.com/ableron/ableron-fastify)

To use `ableron-js` directly, do something like this:

```ts
import { Ableron } from '@ableron/ableron';

const ableron = new Ableron(
  /* optional configuration */
  {
    statsAppendToContent: true
    // ...
  },
  // optional logger
  pinoWinstonMorganOrWhateverYouMayHave() || console
);
const rawResponseBody = buildRawResponseBody();
const req = yourNodeJsRequestObject();
const res = yourNodeJsResponseObject();

try {
  ableron
    .resolveIncludes(rawResponseBody, req.headers)
    .then((transclusionResult) => {
      transclusionResult
        .getResponseHeadersToPass()
        .forEach((headerValue, headerName) => res.setHeader(headerName, headerValue));
      res.setHeader(
        'Cache-Control',
        transclusionResult.calculateCacheControlHeaderValueByResponseHeaders(res.getHeaders())
      );
      res.setHeader('Content-Length', Buffer.byteLength(transclusionResult.getContent()));
      res.status(transclusionResult.getStatusCodeOverride() || res.statusCode);
      setFinalResponseBody(transclusionResult.getContent());
    })
    .catch((e) => {
      logger.error(`[Ableron] Unable to perform UI composition: ${e.stack || e.message}`);
    });
} catch (e) {
  logger.error(`[Ableron] Unable to perform UI composition: ${e.stack || e.message}`);
}
```

### Configuration

#### `enabled`

Default: `true`

Whether UI composition is enabled.

#### `fragmentRequestTimeoutMillis`

Default: `3000`

Timeout in milliseconds for requesting fragments.

#### `fragmentRequestHeadersToPass`

Default:

```js
[
  'Accept-Language',
  'Correlation-ID',
  'Forwarded',
  'Referer',
  'User-Agent',
  'X-Correlation-ID',
  'X-Forwarded-For',
  'X-Forwarded-Proto',
  'X-Forwarded-Host',
  'X-Real-IP',
  'X-Request-ID'
];
```

Request headers that are passed to fragment requests, if present.

#### `fragmentAdditionalRequestHeadersToPass`

Default: `[]`

Extends `fragmentRequestHeadersToPass`. Use this property to pass all headers defined in `fragmentRequestHeadersToPass`
plus the additional headers defined here. This prevents the need to duplicate `fragmentRequestHeadersToPass` if the only
use case is to add additional headers instead of modifying the default ones.

#### `primaryFragmentResponseHeadersToPass`

Default: `['Content-Language', 'Location', 'Refresh']`

Response headers of primary fragments to pass to the page response, if present.

#### `cacheMaxItems`

Default: `10000`

Maximum number of items, the fragment cache may hold.

#### `cacheVaryByRequestHeaders`

Default: `[]`

Fragment request headers which influence the requested fragment aside from its URL. Used to create fragment cache keys.
Must be a subset of `fragmentRequestHeadersToPass`. Common example are headers used for steering A/B-tests.

#### `cacheAutoRefreshEnabled`

Default: `false`

Whether to enable auto-refreshing of cached fragments, before they expire.
If set to `true`, cached fragments are getting asynchronously refreshed before they expire. This reduces the cache miss
rate and thus have a positive impact on latency. On the other hand, additional traffic is introduced, because the cached
fragments are loaded again even before their actual expiration time.
Fragments are tried to be refreshed when only 15% of their initial time to live remains. In case of failure, refresh is
repeated three times with a static delay of one second.

#### `cacheAutoRefreshMaxAttempts`

Default: `3`

Maximum number of attempts to refresh a cached fragment.

#### `cacheAutoRefreshInactiveFragmentMaxRefreshs`

Default: `2`

Maximum number of consecutive refreshs of inactive cached fragments.
Fragments are considered inactive, if they have not been read from cache between writing to cache and a refresh attempt.

#### `statsAppendToContent`

Default: `false`

Whether to append UI composition stats as HTML comment to the content.

#### `statsExposeFragmentUrl`

Default: `false`

Whether to expose fragment URLs in the stats appended to the content.

## Contributing

All contributions are greatly appreciated, be it pull requests, feature requests or bug reports. See
[ableron.github.io](https://ableron.github.io/) for details.

## License

Licensed under [MIT](./LICENSE).
