import { AbleronConfig } from './ableron-config';
import { TransclusionProcessor } from './transclusion-processor';
import { TransclusionResult } from './transclusion-result';

export class Ableron {
  private readonly ableronConfig: AbleronConfig;
  private readonly transclusionProcessor: TransclusionProcessor;

  constructor(ableronConfig: AbleronConfig) {
    this.ableronConfig = ableronConfig;
    this.transclusionProcessor = new TransclusionProcessor(ableronConfig);
  }

  resolveIncludes(content: string, presentRequestHeaders: Map<string, string[]>): TransclusionResult {
    if (this.ableronConfig.enabled) {
      const transclusionResult = this.transclusionProcessor.resolveIncludes(content, presentRequestHeaders);
      console.debug(
        `Ableron UI composition processed ${transclusionResult.getProcessedIncludesCount()} include(s) in ${transclusionResult.getProcessingTimeMillis()}ms`
      );
      return transclusionResult;
    }

    return new TransclusionResult(content);
  }
}
