import { TransclusionProcessor } from '../src/transclusion-processor';
import { AbleronConfig } from '../src';

const transclusionProcessor = new TransclusionProcessor(new AbleronConfig());

test.each([
  ['<ableron-include src="test"/>', '<ableron-include src="test"/>'],
  ['<ableron-include src="test" />', '<ableron-include src="test" />'],
  ['<ableron-include\nsrc="test" />', '<ableron-include\nsrc="test" />'],
  ['<ableron-include\tsrc="test"\t\t/>', '<ableron-include\tsrc="test"\t\t/>'],
  ['<ableron-include src="test"></ableron-include>', '<ableron-include src="test"></ableron-include>'],
  ['<ableron-include src="test"> </ableron-include>', '<ableron-include src="test"> </ableron-include>'],
  [
    '<ableron-include src="test">foo\nbar\nbaz</ableron-include>',
    '<ableron-include src="test">foo\nbar\nbaz</ableron-include>'
  ],
  ['<ableron-include src=">>"/>', '<ableron-include src=">>"/>'],
  ['<ableron-include src="/>"/>', '<ableron-include src="/>"/>'],
  ['\n<ableron-include src="..."/>\n', '<ableron-include src="..."/>'],
  ['<div><ableron-include src="..."/></div>', '<ableron-include src="..."/>'],
  ['<ableron-include src="..."  fallback-src="..."/>', '<ableron-include src="..."  fallback-src="..."/>'],
  ['<ableron-include src="test" primary/>', '<ableron-include src="test" primary/>'],
  ['<ableron-include src="test" primary="primary"/>', '<ableron-include src="test" primary="primary"/>']
])('should recognize includes of different forms', (content: string, expectedRawIncludeTag: string) => {
  expect(transclusionProcessor.findIncludes(content)[0].getRawIncludeTag()).toBe(expectedRawIncludeTag);
});
