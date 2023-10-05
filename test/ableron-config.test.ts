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
  expect(config.cacheMaxSizeInBytes).toBe(10485760);
  expect(config.statsAppendToContent).toBe(false);
});
