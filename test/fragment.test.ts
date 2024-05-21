import { expect, it } from 'vitest';
import Fragment from '../src/fragment.js';

it('should create expired fragment if expiration time is not provided', () => {
  expect(new Fragment(200, '').expirationTime.toISOString()).toBe('1970-01-01T00:00:00.000Z');
});
