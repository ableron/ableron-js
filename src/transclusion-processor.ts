import AbleronConfig from './ableron-config.js';
import TransclusionResult from './transclusion-result.js';
import Include from './include.js';
import Fragment from './fragment.js';
import { LoggerInterface } from './logger.js';
import Stats from './stats';
import FragmentCache from './fragment-cache';

export default class TransclusionProcessor {
  /**
   * Regular expression for matching ableron includes.
   */
  private readonly INCLUDE_PATTERN: RegExp = /<(ableron-include)\s(([^">]|"[^"]*")*?)(\/>|>(.*?)<\/\1>)/gs;

  /**
   * Regular expression for parsing include tag attributes.
   */
  private readonly ATTRIBUTES_PATTERN: RegExp = /\s*([a-zA-Z0-9_-]+)(="([^"]+)")?/gs;

  private readonly logger: LoggerInterface;

  private readonly ableronConfig: AbleronConfig;

  private readonly fragmentCache: FragmentCache;

  private readonly stats: Stats = new Stats();

  constructor(ableronConfig: AbleronConfig, logger: LoggerInterface) {
    this.ableronConfig = ableronConfig;
    this.logger = logger;
    this.fragmentCache = new FragmentCache(this.ableronConfig.cacheAutoRefreshFragments);
  }

  getFragmentCache(): FragmentCache {
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
      this.stats,
      this.ableronConfig.statsAppendToContent,
      this.ableronConfig.statsExposeFragmentUrl,
      this.logger
    );
    await Promise.all(
      Array.from(this.findIncludes(content)).map((include) => {
        try {
          return include
            .resolve(this.ableronConfig, this.fragmentCache, this.stats, parentRequestHeaders)
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
}
