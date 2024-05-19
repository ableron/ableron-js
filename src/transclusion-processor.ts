import AbleronConfig from './ableron-config.js';
import TransclusionResult from './transclusion-result.js';
import Include from './include.js';
import TTLCache from '@isaacs/ttlcache';
import Fragment from './fragment.js';
import { LoggerInterface } from './logger.js';

export default class TransclusionProcessor {
  /**
   * Regular expression for matching ableron includes.
   */
  private readonly INCLUDE_PATTERN: RegExp = /<(ableron-include)\s(([^">]|"[^"]*")*?)(\/>|>(.*?)<\/\1>)/gs;

  /**
   * Regular expression for parsing include tag attributes.
   */
  private readonly ATTRIBUTES_PATTERN: RegExp = /\s*([a-zA-Z0-9_-]+)(="([^"]+)")?/gs;

  private readonly ableronConfig: AbleronConfig;

  private readonly fragmentCache: TTLCache<string, Fragment>;

  private readonly logger: LoggerInterface;

  constructor(ableronConfig: AbleronConfig, logger: LoggerInterface) {
    this.logger = logger;
    this.ableronConfig = ableronConfig;
    this.fragmentCache = this.buildFragmentCache();
  }

  getFragmentCache(): TTLCache<string, Fragment> {
    return this.fragmentCache;
  }

  findIncludes(content: string): Include[] {
    const firstIncludePosition = content.toString().indexOf('<ableron-include');

    return firstIncludePosition === -1
      ? []
      : [
          ...new Map(
            Array.from(content.matchAll(this.INCLUDE_PATTERN)).map((match) => [
              match[0],
              new Include(match[0], this.parseAttributes(match[2]), match[5], this.logger)
            ])
          ).values()
        ];
  }

  async resolveIncludes(content: string, parentRequestHeaders?: Headers): Promise<TransclusionResult> {
    const startTime = Date.now();
    const transclusionResult = new TransclusionResult(
      content,
      this.ableronConfig.statsAppendToContent,
      this.ableronConfig.statsExposeFragmentUrl,
      this.logger
    );
    await Promise.all(
      Array.from(this.findIncludes(content)).map((include) => {
        try {
          return include
            .resolve(this.ableronConfig, this.fragmentCache, parentRequestHeaders)
            .then(() => transclusionResult.addResolvedInclude(include))
            .catch((e) => this.handleResolveError(include, e, transclusionResult, startTime));
        } catch (e: any) {
          this.handleResolveError(include, e, transclusionResult, startTime);
        }
      })
    );
    transclusionResult.setProcessingTimeMillis(Date.now() - startTime);
    return transclusionResult;
  }

  private handleResolveError(
    include: Include,
    e: any,
    transclusionResult: TransclusionResult,
    resolveStartTimeMillis: number
  ): void {
    this.logger.error(
      `[Ableron] Unable to resolve include ${include.getId()}: ${
        e.stack || e.message + (e.cause ? ` (${e.cause})` : '')
      }`
    );
    transclusionResult.addResolvedInclude(
      include.resolveWith(
        new Fragment(200, include.getFallbackContent(), undefined, new Date(new Date().getTime() + 60000)),
        'fallback content',
        Date.now() - resolveStartTimeMillis
      )
    );
  }

  private parseAttributes(attributesString: string): Map<string, string> {
    const attributes = new Map<string, string>();
    const matches = attributesString.matchAll(this.ATTRIBUTES_PATTERN);

    for (const match of matches) {
      attributes.set(match[1], match[3] === undefined ? '' : match[3]);
    }

    return attributes;
  }

  private buildFragmentCache(): TTLCache<string, Fragment> {
    return new TTLCache({ max: 1000, ttl: 24 * 60 * 60 * 1000, checkAgeOnGet: false });
  }
}
