import AbleronConfig from './ableron-config.js';
import TransclusionProcessor from './transclusion-processor.js';
import TransclusionResult from './transclusion-result.js';
import HttpUtil from './http-util.js';
import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http2';
import { LoggerInterface, NoOpLogger } from './logger.js';
import CacheStats from './cache-stats.js';

export default class Ableron {
  private readonly logger: LoggerInterface;
  private readonly ableronConfig: AbleronConfig;
  private readonly transclusionProcessor: TransclusionProcessor;
  private readonly emptyCacheStats: CacheStats = new CacheStats();

  constructor(ableronConfig: Partial<AbleronConfig>, logger?: LoggerInterface) {
    this.logger = logger || new NoOpLogger();
    this.ableronConfig = new AbleronConfig(ableronConfig);
    this.transclusionProcessor = new TransclusionProcessor(this.ableronConfig, this.logger);
  }

  getLogger() {
    return this.logger;
  }

  getConfig() {
    return this.ableronConfig;
  }

  async resolveIncludes(
    content: string,
    parentRequestHeaders: Headers | IncomingHttpHeaders | OutgoingHttpHeaders | { [key: string]: string | string[] }
  ): Promise<TransclusionResult> {
    if (this.ableronConfig.enabled) {
      return await this.transclusionProcessor.resolveIncludes(content, HttpUtil.normalizeHeaders(parentRequestHeaders));
    }

    return new TransclusionResult(content, this.emptyCacheStats, false, false, this.logger);
  }
}
