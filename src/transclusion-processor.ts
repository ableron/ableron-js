import { AbleronConfig } from './ableron-config';
import { TransclusionResult } from './transclusion-result';
import { Include } from './include';

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

  constructor(ableronConfig: AbleronConfig) {
    this.ableronConfig = ableronConfig;
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
    await Promise.all(
      Array.from(this.findIncludes(content)).map((include) => {
        const includeResolveStartTime = Date.now();
        include
          .resolve()
          .then((fragment) => {
            const includeResolveTimeMillis = Date.now() - includeResolveStartTime;
            console.debug('Resolved include %s in %dms', include.getId(), includeResolveTimeMillis);
            transclusionResult.addResolvedInclude(include, fragment, includeResolveTimeMillis);
          })
          .catch((error) => console.log('Unable to resolve include %s: %s', include.getId(), error));
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
}
