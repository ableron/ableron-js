import { describe, expect, it } from 'vitest';
import { Ableron, AbleronConfig } from '../src/index.js';

describe('Ableron', () => {
  it.each([
    [{ enabled: true }, 'fallback', 1],
    [{ enabled: false }, '<ableron-include src="https://foo-bar">fallback</ableron-include>', 0]
  ])(
    'should perform transclusion only if enabled',
    async (ableronConfig: Partial<AbleronConfig>, expectedResult: string, expectedProcessedIncludesCount: number) => {
      // when
      const result = await new Ableron(new AbleronConfig(ableronConfig)).resolveIncludes(
        '<ableron-include src="https://foo-bar">fallback</ableron-include>',
        new Headers()
      );

      // then
      expect(result.getContent()).toBe(expectedResult);
      expect(result.getProcessedIncludesCount()).toBe(expectedProcessedIncludesCount);
    }
  );

  it('should accept provided external logger', async () => {
    // given
    const logMessages: any[] = [];
    const logger = {
      error: function _() {},
      warn: function _() {},
      info: function _() {},
      log: function _() {},
      debug: function _(data: any) {
        logMessages.push(data);
      }
    };
    const ableron = new Ableron(new AbleronConfig(), logger);

    // when
    await ableron.resolveIncludes('', new Headers());

    // then
    expect(logMessages[0]).toMatch(/^\[Ableron] Processed 0 includes in \d+ms$/);
  });

  it('should create complete config', () => {
    expect(new Ableron({ enabled: false }).getConfig().fragmentRequestTimeoutMillis).toBe(3000);
  });
});
