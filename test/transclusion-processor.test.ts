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

test.each([
  ['<ableron-include/>'],
  ['<ableron-include >'],
  ['<ableron-include src="s">'],
  ['<ableron-include src="s" b="b">']
])('should not recognize includes with invalid format', (content: string) => {
  expect(transclusionProcessor.findIncludes(content)).toHaveLength(0);
});

test('should accept line breaks in include tag attributes', () => {
  // when
  const include = transclusionProcessor.findIncludes(
    '<ableron-include\nsrc="https://foo.bar/fragment-1"\nfallback-src="https://foo.bar/fragment-1-fallback"/>'
  )[0];

  // then
  expect(include.getSrc()).toBe('https://foo.bar/fragment-1');
  expect(include.getFallbackSrc()).toBe('https://foo.bar/fragment-1-fallback');
});

test.each([
  ['<ableron-include src="https://example.com"/>', new Map([['src', 'https://example.com']])],
  ['<ableron-include  src="https://example.com"/>', new Map([['src', 'https://example.com']])],
  ['<ableron-include   src="https://example.com"/>', new Map([['src', 'https://example.com']])],
  ['<ableron-include -src="https://example.com"/>', new Map([['-src', 'https://example.com']])],
  ['<ableron-include _src="https://example.com"/>', new Map([['_src', 'https://example.com']])],
  ['<ableron-include 0src="https://example.com"/>', new Map([['0src', 'https://example.com']])],
  [
    '<ableron-include foo="" src="https://example.com"/>',
    new Map([
      ['foo', ''],
      ['src', 'https://example.com']
    ])
  ],
  [
    '<ableron-include src="source" fallback-src="fallback"/>',
    new Map([
      ['src', 'source'],
      ['fallback-src', 'fallback']
    ])
  ],
  [
    '<ableron-include fallback-src="fallback" src="source"/>',
    new Map([
      ['src', 'source'],
      ['fallback-src', 'fallback']
    ])
  ],
  [
    '<ableron-include src=">" fallback-src="/>"/>',
    new Map([
      ['src', '>'],
      ['fallback-src', '/>']
    ])
  ],
  [
    '<ableron-include src="https://example.com" primary/>',
    new Map([
      ['src', 'https://example.com'],
      ['primary', '']
    ])
  ],
  [
    '<ableron-include primary src="https://example.com"/>',
    new Map([
      ['src', 'https://example.com'],
      ['primary', '']
    ])
  ],
  [
    '<ableron-include src="https://example.com" primary="primary"/>',
    new Map([
      ['src', 'https://example.com'],
      ['primary', 'primary']
    ])
  ],
  [
    '<ableron-include src="https://example.com" primary="foo"/>',
    new Map([
      ['src', 'https://example.com'],
      ['primary', 'foo']
    ])
  ]
])('should parse include tag attributes', (content: string, expectedRawAttributes: Map<string, string>) => {
  expect(transclusionProcessor.findIncludes(content)[0].getRawAttributes()).toEqual(expectedRawAttributes);
});

test('should find all includes in input content', () => {
  expect(
    transclusionProcessor
      .findIncludes(
        '<html>' +
          '<head>' +
          '<ableron-include src="https://foo.bar/baz?test=123" />' +
          '<title>Foo</title>' +
          '<ableron-include foo="bar" src="https://foo.bar/baz?test=456"/>' +
          '</head>' +
          '<body>' +
          '<ableron-include src="https://foo.bar/baz?test=789" fallback-src="https://example.com"/>' +
          '<ableron-include src="https://foo.bar/baz?test=789" fallback-src="https://example.com">fallback</ableron-include>' +
          '</body>' +
          '</html>'
      )
      .map((include) => include.getRawIncludeTag())
  ).toEqual([
    '<ableron-include src="https://foo.bar/baz?test=123" />',
    '<ableron-include foo="bar" src="https://foo.bar/baz?test=456"/>',
    '<ableron-include src="https://foo.bar/baz?test=789" fallback-src="https://example.com"/>',
    '<ableron-include src="https://foo.bar/baz?test=789" fallback-src="https://example.com">fallback</ableron-include>'
  ]);
});
