# Ableron JavaScript Library

[![Build Status](https://github.com/ableron/ableron-js/actions/workflows/test.yml/badge.svg)](https://github.com/ableron/ableron-js/actions/workflows/test.yml)

JavaScript Library for Ableron Server Side UI Composition.

## Installation

```shell
npm install ableron
```

### Configuration Options

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
- `statsAppendToContent`: Whether to append UI composition stats as HTML comment to the content. Defaults to `false`
