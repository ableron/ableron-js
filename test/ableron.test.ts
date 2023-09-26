import { Ableron, AbleronConfig } from '../src/index';

test.each([
  [{ enabled: true }, 'fallback', 1],
  [{ enabled: false }, '<ableron-include src="https://foo-bar">fallback</ableron-include>', 0]
])(
  'should perform transclusion only if enabled',
  (ableronConfig: Partial<AbleronConfig>, expectedResult: string, expectedProcessedIncludesCount: number) => {
    const ableron = new Ableron(new AbleronConfig(ableronConfig));
    const result = ableron.resolveIncludes(
      '<ableron-include src="https://foo-bar">fallback</ableron-include>',
      new Map<string, string[]>()
    );
    expect(result.getContent()).toBe(expectedResult);
    expect(result.getProcessedIncludesCount()).toBe(expectedProcessedIncludesCount);
  }
);
