import { CaseInsensitiveMap } from '../src/case-insensitive-map';

test('should treat keys as case insensitive', () => {
  // when
  const map = new CaseInsensitiveMap([
    ['TEST_UPPER', 'TEST_UPPER'],
    ['test_lower', 'test_lower'],
    ['TEST_mixed', 'TEST_mixed']
  ]);

  // then
  expect(map.get('test_upper')).toBe('TEST_UPPER');
  expect(map.has('test_upper')).toBe(true);
  expect(map.get('TEST_LOWER')).toBe('test_lower');
  expect(map.has('TEST_LOWER')).toBe(true);
  expect(map.get('test_MIXED')).toBe('TEST_mixed');
  expect(map.has('test_MIXED')).toBe(true);
});
