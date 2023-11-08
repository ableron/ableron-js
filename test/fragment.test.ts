import Fragment from '../src/fragment.js';

test('should create expired fragment if expiration time is not provided', () => {
  expect(new Fragment(200, '').expirationTime.toISOString()).toBe('1970-01-01T00:00:00.000Z');
});

test.each([
  [undefined, false],
  ['', true],
  ['http://example.com', true]
])(
  'should provide isRemote() based on existence of fragment url',
  async (url: string | undefined, expectedIsRemote: boolean) => {
    expect(new Fragment(200, '', url).isRemote).toBe(expectedIsRemote);
  }
);
