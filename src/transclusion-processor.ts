import { AbleronConfig } from './ableron-config';
import { TransclusionResult } from './transclusion-result';

export class TransclusionProcessor {
  private readonly ableronConfig: AbleronConfig;

  constructor(ableronConfig: AbleronConfig) {
    this.ableronConfig = ableronConfig;
  }

  resolveIncludes(content: string, presentRequestHeaders: Map<string, string[]>): TransclusionResult {
    const startTime = Date.now();
    const transclusionResult = new TransclusionResult(content, this.ableronConfig.statsAppendToContent);

    //TODO: Implement
    transclusionResult.addResolvedInclude();
    // findIncludes().map (include => include.resolve());...

    transclusionResult.setProcessingTimeMillis(Date.now() - startTime);
    return transclusionResult;
  }
}
