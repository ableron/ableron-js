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

  resolveIncludes(content: string, presentRequestHeaders: Map<string, string[]>): TransclusionResult {
    const startTime = Date.now();
    const transclusionResult = new TransclusionResult(content, this.ableronConfig.statsAppendToContent);

    //TODO: Implement
    this.findIncludes(content).forEach((include) => {
      transclusionResult.addResolvedInclude();
      console.log(include);
    });
    transclusionResult.setProcessingTimeMillis(Date.now() - startTime);
    return transclusionResult;
  }
}
