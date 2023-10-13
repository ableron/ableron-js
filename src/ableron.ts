import { AbleronConfig } from './ableron-config';
import { TransclusionProcessor } from './transclusion-processor';
import { TransclusionResult } from './transclusion-result';
import { AbstractLogger } from './abstract-logger';

export class Ableron {
  private readonly logger: AbstractLogger;
  private readonly ableronConfig: AbleronConfig;
  private readonly transclusionProcessor: TransclusionProcessor;

  constructor(ableronConfig: AbleronConfig, logger?: AbstractLogger) {
    this.logger = logger || new AbstractLogger();
    this.ableronConfig = ableronConfig;
    this.transclusionProcessor = new TransclusionProcessor(ableronConfig);
  }

  async resolveIncludes(content: string, presentRequestHeaders: Headers): Promise<TransclusionResult> {
    if (this.ableronConfig.enabled) {
      const transclusionResult = await this.transclusionProcessor.resolveIncludes(content, presentRequestHeaders);
      this.logger.debug(
        `Ableron UI composition processed ${transclusionResult.getProcessedIncludesCount()} include(s) in ${transclusionResult.getProcessingTimeMillis()}ms`
      );
      return transclusionResult;
    }

    return new TransclusionResult(content);
  }
}
