import { Include } from './include';
import { Fragment } from './fragment';

export class TransclusionResult {
  private content: string;
  private readonly appendStatsToContent: boolean;
  private processedIncludesCount: number = 0;
  private processingTimeMillis: number = 0;
  private readonly resolvedIncludesLog: string[] = [];

  constructor(content: string, appendStatsToContent: boolean = false) {
    this.content = content;
    this.appendStatsToContent = appendStatsToContent;
  }

  getContent(): string {
    return this.appendStatsToContent ? this.content + this.getStats() : this.content;
  }

  getProcessedIncludesCount(): number {
    return this.processedIncludesCount;
  }

  getProcessingTimeMillis(): number {
    return this.processingTimeMillis;
  }

  setProcessingTimeMillis(processingTimeMillis: number): void {
    this.processingTimeMillis = processingTimeMillis;
  }

  addResolvedInclude(include: Include, fragment: Fragment, includeResolveTimeMillis: number) {
    //TODO: Implement
    this.content = 'fallback';
    this.processedIncludesCount++;
  }

  private getStats(): string {
    let stats = `\n<!-- Ableron stats:\nProcessed ${this.processedIncludesCount} include(s) in ${this.processingTimeMillis}ms\n`;
    this.resolvedIncludesLog.forEach((logEntry) => (stats = stats + logEntry + '\n'));
    return stats + '-->';
  }
}
