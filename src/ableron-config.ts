export class AbleronConfig {
  /**
   * Whether UI composition is enabled.
   */
  readonly enabled: boolean = true;

  /**
   * Timeout for requesting fragments.
   */
  readonly fragmentRequestTimeoutMillis: number = 3000;

  /**
   * Request headers that are passed to fragment requests if present.
   */
  readonly fragmentRequestHeadersToPass = [
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

  /**
   * Response headers of primary fragments to pass to the page response if present.
   */
  readonly primaryFragmentResponseHeadersToPass = ['Content-Language', 'Location', 'Refresh'];

  /**
   * Maximum size in bytes the fragment cache may have.
   */
  readonly cacheMaxSizeInBytes = 1024 * 1024 * 10;

  /**
   * Whether to append UI composition stats as HTML comment to the content.
   */
  readonly statsAppendToContent: boolean = false;

  constructor(init?: Partial<AbleronConfig>) {
    Object.assign(this, init);
  }
}
