import { AbleronConfig } from "./ableron-config";
import { TransclusionProcessor } from "./transclusion-processor";
import { TransclusionResult } from "./transclusion-result";

export class Ableron {
  private readonly ableronConfig: AbleronConfig;
  private readonly transclusionProcessor: TransclusionProcessor;

  constructor(ableronConfig: AbleronConfig) {
    this.ableronConfig = ableronConfig;
    this.transclusionProcessor = new TransclusionProcessor(ableronConfig);
  }

  resolveIncludes(content: string, presentRequestHeaders: Map<string, string[]>): TransclusionResult {
    if (this.ableronConfig.enabled) {
      const transclusionResult = this.transclusionProcessor.resolveIncludes(content, presentRequestHeaders)
      //TODO: logger.debug("Ableron UI composition processed {} includes in {}ms", transclusionResult.getProcessedIncludesCount(), transclusionResult.getProcessingTimeMillis())
      return transclusionResult;
    }

    return new TransclusionResult(content);
  }
}
