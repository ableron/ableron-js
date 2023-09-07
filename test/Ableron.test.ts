import { Ableron } from '../src/index'

test('getData', () => {
  expect(new Ableron("foo").getData()).toBe("foo")
})
