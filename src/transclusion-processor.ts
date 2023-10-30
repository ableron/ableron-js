import { AbleronConfig } from './ableron-config';
import { TransclusionResult } from './transclusion-result';
import { Include } from './include';
import TTLCache from '@isaacs/ttlcache';
import { Fragment } from './fragment';
import { AbstractLogger } from './abstract-logger';

export class TransclusionProcessor {
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

  private readonly logger: AbstractLogger;

  constructor(ableronConfig: AbleronConfig, logger?: AbstractLogger) {
    this.logger = logger || new AbstractLogger();
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
              new Include(this.parseAttributes(match[2]), match[5], match[0], this.logger)
            ])
          ).values()
        ];
  }

  async resolveIncludes(content: string, presentRequestHeaders: Headers): Promise<TransclusionResult> {
    const startTime = Date.now();
    const transclusionResult = new TransclusionResult(content, this.ableronConfig.statsAppendToContent, this.logger);
    await Promise.all(
      Array.from(this.findIncludes(content)).map((include) => {
        try {
          const includeResolveStartTime = Date.now();
          return include
            .resolve(this.ableronConfig, this.fragmentCache, presentRequestHeaders)
            .then((fragment) => {
              const includeResolveTimeMillis = Date.now() - includeResolveStartTime;
              this.logger.debug('Resolved include %s in %dms', include.getId(), includeResolveTimeMillis);
              transclusionResult.addResolvedInclude(include, fragment, includeResolveTimeMillis);
            })
            .catch((e) => {
              this.logger.error(
                `Unable to resolve include ${include.getId()}: ${
                  e.stack ? e.stack : e.message + (e.cause ? ` (${e.cause})` : '')
                }`
              );
              transclusionResult.addUnresolvableInclude(include, e.message);
            });
        } catch (e: any) {
          this.logger.error(
            `Unable to resolve include ${include.getId()}: ${
              e.stack ? e.stack : e.message + (e.cause ? ` (${e.cause})` : '')
            }`
          );
          transclusionResult.addUnresolvableInclude(include, e.message);
        }
      })
    );
    transclusionResult.setProcessingTimeMillis(Date.now() - startTime);
    return transclusionResult;
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
