# Ableron JavaScript Library

[![Build Status](https://github.com/ableron/ableron-js/actions/workflows/test.yml/badge.svg)](https://github.com/ableron/ableron-js/actions/workflows/test.yml)
[![npm version](https://badge.fury.io/js/@ableron%2Fableron.svg)](https://badge.fury.io/js/@ableron%2Fableron)
[![Node.js Version](https://img.shields.io/badge/Node.js-19+-4EB1BA.svg)](https://nodejs.org/docs/latest-v19.x/api/)

JavaScript Library for Ableron Server Side UI Composition.

## Installation

```shell
npm i @ableron/ableron
```

## Usage

```ts
import { Ableron } from '@ableron/ableron';

const yourLoggerInstance = pinoWinstonMorganOrWhateverYouMayHave() || console;
const ableron = new Ableron({}, yourLoggerInstance);
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
      logger.error(`Unable to perform ableron UI composition: ${e.stack || e.message}`);
    });
} catch (e) {
  logger.error(`Unable to perform ableron UI composition: ${e.stack || e.message}`);
}
```

## Configuration

```ts
import { Ableron } from '@ableron/ableron';
const ableron = new Ableron({
  // apply your configuration here
});
```

- `enabled`: Whether UI composition is enabled. Defaults to `true`
- `fragmentRequestTimeout`: Timeout for requesting fragments. Defaults to `3 seconds`
- `fragmentRequestHeadersToPass`: Request headers that are passed to fragment requests if present. Defaults to:
  - `Accept-Language`
  - `Correlation-ID`
  - `Forwarded`
  - `Referer`
  - `User-Agent`
  - `X-Correlation-ID`
  - `X-Forwarded-For`
  - `X-Forwarded-Proto`
  - `X-Forwarded-Host`
  - `X-Real-IP`
  - `X-Request-ID`
- `primaryFragmentResponseHeadersToPass`: Response headers of primary fragments to pass to the page response if present. Defaults to:
  - `Content-Language`
  - `Location`
  - `Refresh`
- `cacheVaryByRequestHeaders`: Fragment request headers which influence the requested fragment aside from its URL. Used to create fragment cache keys. Defaults to an empty list. Must be a subset of `fragmentRequestHeadersToPass`. Common example are headers used for steering A/B-tests
- `statsAppendToContent`: Whether to append UI composition stats as HTML comment to the content. Defaults to `false`
