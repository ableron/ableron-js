import { Ableron, AbleronConfig } from '../src';

test.each([
  [{ enabled: true }, 'fallback', 1],
  [{ enabled: false }, '<ableron-include src="https://foo-bar">fallback</ableron-include>', 0]
])(
  'should perform transclusion only if enabled',
  async (ableronConfig: Partial<AbleronConfig>, expectedResult: string, expectedProcessedIncludesCount: number) => {
    const ableron = new Ableron(new AbleronConfig(ableronConfig));
    const result = await ableron.resolveIncludes(
      '<ableron-include src="https://foo-bar">fallback</ableron-include>',
      new Headers()
    );
    expect(result.getContent()).toBe(expectedResult);
    expect(result.getProcessedIncludesCount()).toBe(expectedProcessedIncludesCount);
  }
);
