import { AbleronConfig } from './ableron-config';
import { TransclusionResult } from './transclusion-result';

export class TransclusionProcessor {
  private readonly ableronConfig: AbleronConfig;

  constructor(ableronConfig: AbleronConfig) {
    this.ableronConfig = ableronConfig;
  }

  resolveIncludes(content: string, presentRequestHeaders: Map<string, string[]>): TransclusionResult {
    return new TransclusionResult(content);
  }
}
