import AbleronConfig from './ableron-config.js';
import TransclusionProcessor from './transclusion-processor.js';
import TransclusionResult from './transclusion-result.js';
import AbstractLogger from './abstract-logger.js';
import HttpUtil from './http-util.js';
import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http2';

export default class Ableron {
  private readonly logger: AbstractLogger;
  private readonly ableronConfig: AbleronConfig;
  private readonly transclusionProcessor: TransclusionProcessor;

  constructor(ableronConfig: Partial<AbleronConfig>, logger?: AbstractLogger) {
    this.logger = logger || new AbstractLogger();
    this.ableronConfig = new AbleronConfig(ableronConfig);
    this.transclusionProcessor = new TransclusionProcessor(this.ableronConfig);
  }

  getConfig() {
    return this.ableronConfig;
  }

  async resolveIncludes(
    content: string,
    presentRequestHeaders: Headers | IncomingHttpHeaders | OutgoingHttpHeaders | { [key: string]: string | string[] }
  ): Promise<TransclusionResult> {
    if (this.ableronConfig.enabled) {
      const transclusionResult = await this.transclusionProcessor.resolveIncludes(
        content,
        HttpUtil.normalizeHeaders(presentRequestHeaders)
      );
      this.logger.debug(
        `Ableron UI composition processed ${transclusionResult.getProcessedIncludesCount()} include(s) in ${transclusionResult.getProcessingTimeMillis()}ms`
      );
      return transclusionResult;
    }

    return new TransclusionResult(content);
  }
}
