import { AbleronConfig } from '../src';

test('should have default value for each property', () => {
  // when
  const config = new AbleronConfig();

  // then
  expect(config.enabled).toBe(true);
  expect(config.fragmentRequestTimeoutMillis).toBe(3000);
  expect(config.fragmentRequestHeadersToPass).toEqual([
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
  ]);
  expect(config.primaryFragmentResponseHeadersToPass).toEqual(['Content-Language', 'Location', 'Refresh']);
  expect(config.cacheMaxSizeInBytes).toBe(1024 * 1024 * 10);
  expect(config.statsAppendToContent).toBe(false);
});

test('should use values provided via constructor', () => {
  // when
  const config = new AbleronConfig({
    enabled: false,
    fragmentRequestTimeoutMillis: 200,
    fragmentRequestHeadersToPass: ['X-Test-Request-Header', 'X-Test-Request-Header-2'],
    primaryFragmentResponseHeadersToPass: ['X-Test-Response-Header', 'X-Test-Response-Header-2'],
    cacheMaxSizeInBytes: 1024 * 100,
    statsAppendToContent: true
  });

  // then
  expect(config.enabled).toBe(false);
  expect(config.fragmentRequestTimeoutMillis).toBe(200);
  expect(config.fragmentRequestHeadersToPass).toEqual(['X-Test-Request-Header', 'X-Test-Request-Header-2']);
  expect(config.primaryFragmentResponseHeadersToPass).toEqual(['X-Test-Response-Header', 'X-Test-Response-Header-2']);
  expect(config.cacheMaxSizeInBytes).toBe(1024 * 100);
  expect(config.statsAppendToContent).toBe(true);
});
