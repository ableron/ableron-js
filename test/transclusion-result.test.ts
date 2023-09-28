import { TransclusionResult } from '../src';

test('should return reasonable defaults', () => {
  // given
  const transclusionResult = new TransclusionResult('content');

  // expect
  expect(transclusionResult.getContent()).toBe('content');
  expect(transclusionResult.getContentExpirationTime()).toBeUndefined();
  expect(transclusionResult.getHasPrimaryInclude()).toBe(false);
  expect(transclusionResult.getStatusCodeOverride()).toBeUndefined();
  expect(transclusionResult.getResponseHeadersToPass()).toEqual(new Map());
  expect(transclusionResult.getProcessedIncludesCount()).toBe(0);
  expect(transclusionResult.getProcessingTimeMillis()).toBe(0);
});

test('should set processing time', () => {
  // given
  const transclusionResult = new TransclusionResult('content');

  // when
  transclusionResult.setProcessingTimeMillis(111);

  // then
  expect(transclusionResult.getProcessingTimeMillis()).toBe(111);
});

test('should not append stats to content by default', () => {
  expect(new TransclusionResult('content').getContent()).toBe('content');
});

test('should append stats to content - zero includes', () => {
  expect(new TransclusionResult('content', true).getContent()).toBe(
    'content\n<!-- Ableron stats:\nProcessed 0 include(s) in 0ms\n-->'
  );
});
