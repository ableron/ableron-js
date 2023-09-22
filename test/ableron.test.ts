import {Ableron, AbleronConfig} from '../src/index'

test('resolveIncludes', () => {
  expect(new Ableron(new AbleronConfig()).resolveIncludes('test', new Map()).getContent()).toBe('test')
})
