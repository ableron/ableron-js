import { TransclusionResult } from '../src';

test('should return reasonable defaults', () => {
  const transclusionResult = new TransclusionResult('content');

  expect(transclusionResult.getContent()).toBe('content');
});
