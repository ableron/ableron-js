import { AbleronConfig } from './ableron-config';
import { TransclusionResult } from './transclusion-result';
import { Include } from './include';

export class TransclusionProcessor {
  /**
   * Regular expression for matching ableron includes.
   */
  private readonly INCLUDE_PATTERN: RegExp = /<(ableron-include)\s(([^">]|"[^"]*")*?)(\/>|>(.*?)<\/\1>)/g;

  private readonly ableronConfig: AbleronConfig;

  constructor(ableronConfig: AbleronConfig) {
    this.ableronConfig = ableronConfig;
  }

  findIncludes(content: string): Set<Include> {
    const firstIncludePosition = content.indexOf('<ableron-include');

    return firstIncludePosition === -1
      ? new Set()
      : new Set(
          Array.from(
            content.matchAll(this.INCLUDE_PATTERN),
            (match) => new Include(new Map<string, string>(), match[5], match[0])
          )
        );
  }

  async resolveIncludes(content: string, presentRequestHeaders: Map<string, string[]>): Promise<TransclusionResult> {
    const startTime = Date.now();
    const transclusionResult = new TransclusionResult(content, this.ableronConfig.statsAppendToContent);
    await Promise.all(
      Array.from(this.findIncludes(content)).map((include) => {
        const includeResolveStartTime = Date.now();
        include
          .resolve()
          .then((fragment) => {
            const includeResolveTimeMillis = Date.now() - includeResolveStartTime;
            console.debug('Resolved include %s in %dms', include.id, includeResolveTimeMillis);
            transclusionResult.addResolvedInclude(include, fragment, includeResolveTimeMillis);
          })
          .catch((error) => console.log('Unable to resolve include %s: %s', include.id, error));
      })
    );
    transclusionResult.setProcessingTimeMillis(Date.now() - startTime);
    return transclusionResult;
  }
}
