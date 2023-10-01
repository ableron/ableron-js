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

test('should treat multiple identical includes as one include', () => {
  expect(
    transclusionProcessor
      .findIncludes(
        '<html>' +
          '<head>' +
          '  <ableron-include src="https://foo.bar/baz?test=123"/>' +
          '  <ableron-include src="https://foo.bar/baz?test=123"/>' +
          '  <title>Foo</title>' +
          '  <ableron-include foo="bar" src="https://foo.bar/baz?test=456"></ableron-include>' +
          '  <ableron-include foo="bar" src="https://foo.bar/baz?test=456"></ableron-include>' +
          '  </head>' +
          '  <body>' +
          '  <ableron-include src="...">...</ableron-include>' +
          '<ableron-include src="...">...</ableron-include>' +
          '</body>' +
          '</html>'
      )
      .map((include) => include.getRawIncludeTag())
  ).toEqual([
    '<ableron-include src="https://foo.bar/baz?test=123"/>',
    '<ableron-include foo="bar" src="https://foo.bar/baz?test=456"></ableron-include>',
    '<ableron-include src="...">...</ableron-include>'
  ]);
});

test('should perform search for includes in big input string', () => {
  // given
  let randomStringWithoutIncludes = '';

  for (let i = 0; i < 512 * 1024; i++) {
    // @see https://stackoverflow.com/questions/1527803/generating-random-whole-numbers-in-javascript-in-a-specific-range#1527820
    // Code Points 32 (inclusive) - 127 (exclusive) = Printable ASCII Characters from Space to Tilde
    randomStringWithoutIncludes += String.fromCodePoint(Math.floor(Math.random() * (127 - 32 + 1)) + 32);
  }

  const randomStringWithIncludeAtTheBeginning = '<ableron-include />' + randomStringWithoutIncludes;
  const randomStringWithIncludeAtTheEnd = randomStringWithoutIncludes + '<ableron-include />';
  const randomStringWithIncludeAtTheMiddle =
    randomStringWithoutIncludes + '<ableron-include />' + randomStringWithoutIncludes;

  // expect
  expect(transclusionProcessor.findIncludes(randomStringWithoutIncludes)).toHaveLength(0);
  expect(transclusionProcessor.findIncludes(randomStringWithIncludeAtTheBeginning)).toHaveLength(1);
  expect(transclusionProcessor.findIncludes(randomStringWithIncludeAtTheEnd)).toHaveLength(1);
  expect(transclusionProcessor.findIncludes(randomStringWithIncludeAtTheMiddle)).toHaveLength(1);
});

test('should populate TransclusionResult', async () => {
  // when
  const result = await transclusionProcessor.resolveIncludes(
    '<html>\n' +
      '<head>\n' +
      '  <ableron-include src="https://foo.bar/baz?test=123"><!-- failed loading 1st include --></ableron-include>\n' +
      '<title>Foo</title>\n' +
      '<ableron-include foo="bar" src="https://foo.bar/baz?test=456"><!-- failed loading 2nd include --></ableron-include>\n' +
      '</head>\n' +
      '<body>\n' +
      '<ableron-include src="https://foo.bar/baz?test=789"><!-- failed loading 3rd include --></ableron-include>\n' +
      '</body>\n' +
      '</html>',
    new Map()
  );

  // then
  expect(result.getProcessedIncludesCount()).toBe(3);
  expect(result.getProcessingTimeMillis()).toBeGreaterThanOrEqual(1);
  expect(result.getContent()).toBe(
    '<html>\n' +
      '<head>\n' +
      '  <!-- failed loading 1st include -->\n' +
      '<title>Foo</title>\n' +
      '<!-- failed loading 2nd include -->\n' +
      '</head>\n' +
      '<body>\n' +
      '<!-- failed loading 3rd include -->\n' +
      '</body>\n' +
      '</html>'
  );
});
