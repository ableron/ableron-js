export class TransclusionResult {
  private readonly content: string;
  private readonly appendStatsToContent: boolean;
  private readonly processedIncludesCount: number = 0;
  private readonly processingTimeMillis: number = 0;
  private readonly resolvedIncludesLog: string[] = [];

  constructor(content: string, appendStatsToContent: boolean = false) {
    this.content = content;
    this.appendStatsToContent = appendStatsToContent;
  }

  getContent(): string {
    return this.appendStatsToContent ? this.content + this.getStats() : this.content;
  }

  private getStats(): string {
    let stats = `\n<!-- Ableron stats:\nProcessed ${this.processedIncludesCount} include(s) in ${this.processingTimeMillis}ms\n`;
    this.resolvedIncludesLog.forEach((logEntry) => (stats = stats + logEntry + '\n'));
    return stats + '-->';
  }
}
