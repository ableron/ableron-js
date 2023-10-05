import { AbleronConfig } from '../src';

test('should have default value for each property', () => {
  // when
  const config = new AbleronConfig();

  // then
  expect(config.enabled).toBe(true);
  expect(config.fragmentRequestTimeoutMillis).toBe(3000);
  expect(config.statsAppendToContent).toBe(false);
});
