export default class AbleronConfig {
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
  readonly fragmentRequestHeadersToPass: string[] = [
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
   * Request headers that are passed to fragment requests in addition to fragmentRequestHeadersToPass.
   */
  readonly fragmentAdditionalRequestHeadersToPass: string[] = [];

  /**
   * Response headers of primary fragments to pass to the page response if present.
   */
  readonly primaryFragmentResponseHeadersToPass: string[] = ['Content-Language', 'Location', 'Refresh'];

  /**
   * Maximum number of items, the fragment cache may hold.
   */
  readonly cacheMaxItems: number = 10000;

  /**
   * Fragment request headers which influence the requested fragment aside from its URL.
   */
  readonly cacheVaryByRequestHeaders: string[] = [];

  /**
   * Whether to enable auto-refreshing of cached fragments.
   */
  readonly cacheAutoRefreshEnabled: boolean = false;

  /**
   * Maximum number of consecutive refreshs of unused cached fragments.<br>
   * A fragment is considered unused, if the cache has not been queried
   * for the fragment between two cache refreshs.
   */
  readonly cacheAutoRefreshInactiveEntryMaxRefreshs: number = 2;

  /**
   * Whether to append UI composition stats as HTML comment to the content.
   */
  readonly statsAppendToContent: boolean = false;

  /**
   * Whether to expose fragment URLs in the stats appended to the content.
   */
  readonly statsExposeFragmentUrl: boolean = false;

  constructor(init?: Partial<AbleronConfig>) {
    Object.assign(this, init);
  }
}
