import { AbleronConfig } from './ableron-config';
import { TransclusionResult } from './transclusion-result';
import { Include } from './include';
import { LRUCache } from 'lru-cache';
import { Fragment } from './fragment';

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

  private readonly fragmentCache: LRUCache<string, Fragment>;

  constructor(ableronConfig: AbleronConfig) {
    this.ableronConfig = ableronConfig;
    this.fragmentCache = this.buildFragmentCache(this.ableronConfig.cacheMaxSizeInBytes);
  }

  getFragmentCache(): LRUCache<string, Fragment> {
    return this.fragmentCache;
  }

  findIncludes(content: string): Include[] {
    const firstIncludePosition = content.indexOf('<ableron-include');

    return firstIncludePosition === -1
      ? []
      : [
          ...new Map(
            Array.from(content.matchAll(this.INCLUDE_PATTERN)).map((match) => [
              match[0],
              new Include(this.parseAttributes(match[2]), match[5], match[0])
            ])
          ).values()
        ];
  }

  async resolveIncludes(content: string, presentRequestHeaders: Map<string, string[]>): Promise<TransclusionResult> {
    const startTime = Date.now();
    const transclusionResult = new TransclusionResult(content, this.ableronConfig.statsAppendToContent);
    //TODO: Promise.all() + await include.resolve() does not make sense
    await Promise.all(
      Array.from(this.findIncludes(content)).map(async (include) => {
        const includeResolveStartTime = Date.now();
        await include
          .resolve(this.ableronConfig, this.fragmentCache)
          .then((fragment) => {
            const includeResolveTimeMillis = Date.now() - includeResolveStartTime;
            console.debug('Resolved include %s in %dms', include.getId(), includeResolveTimeMillis);
            transclusionResult.addResolvedInclude(include, fragment, includeResolveTimeMillis);
          })
          .catch((error) =>
            console.error(
              `Unable to resolve include ${include.getId()}: ${error?.message}${
                error?.cause ? ` (${error.cause})` : ''
              }`
            )
          );
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

  private buildFragmentCache(cacheMaxSizeInBytes: number): LRUCache<string, Fragment> {
    return new LRUCache({
      max: 1000,
      maxSize: cacheMaxSizeInBytes,
      sizeCalculation: (fragment, key) => fragment.content.length || 1,
      ttl: 24 * 60 * 60 * 1000
    });
  }
}
