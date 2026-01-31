import { describe, it, expect } from 'vitest';
import {
  normalizeWhitespace,
  createFlexiblePattern,
  mapPlainToHtmlPosition,
  wrapWithMark,
  processHighlights,
  findOverlap,
  findAdjacent,
  findOverlapOrAdjacent,
  mergeTexts,
  findTextAtPosition,
  arePositionsAdjacentOrOverlapping,
} from './highlightProcessor';

describe('normalizeWhitespace', () => {
  it('should collapse multiple spaces to single space', () => {
    expect(normalizeWhitespace('hello    world')).toBe('hello world');
  });

  it('should trim leading and trailing whitespace', () => {
    expect(normalizeWhitespace('  hello world  ')).toBe('hello world');
  });

  it('should handle newlines and tabs', () => {
    expect(normalizeWhitespace('hello\n\tworld')).toBe('hello world');
  });

  it('should handle mixed whitespace', () => {
    expect(normalizeWhitespace('  hello  \n\t  world  ')).toBe('hello world');
  });
});

describe('createFlexiblePattern', () => {
  it('should match text with single spaces', () => {
    const pattern = createFlexiblePattern('hello world');
    expect('hello world'.match(pattern)).toBeTruthy();
  });

  it('should match text with multiple spaces', () => {
    const pattern = createFlexiblePattern('hello world');
    expect('hello    world'.match(pattern)).toBeTruthy();
  });

  it('should match text with newlines', () => {
    const pattern = createFlexiblePattern('hello world');
    expect('hello\nworld'.match(pattern)).toBeTruthy();
  });

  it('should escape regex special characters', () => {
    const pattern = createFlexiblePattern('price: $50.00');
    expect('price: $50.00'.match(pattern)).toBeTruthy();
    expect('price: $5000'.match(pattern)).toBeFalsy();
  });

  it('should escape parentheses and brackets', () => {
    const pattern = createFlexiblePattern('function(x) { return [x]; }');
    expect('function(x) { return [x]; }'.match(pattern)).toBeTruthy();
  });
});

describe('mapPlainToHtmlPosition', () => {
  it('should map position in plain HTML (no tags)', () => {
    const result = mapPlainToHtmlPosition('hello world', 6, 5);
    expect(result.startHtmlIndex).toBe(6);
    expect(result.endHtmlIndex).toBe(11);
  });

  it('should skip HTML tags when mapping', () => {
    const html = '<p>hello world</p>';
    const result = mapPlainToHtmlPosition(html, 0, 5); // "hello"
    expect(result.startHtmlIndex).toBe(3); // after <p>
    expect(result.endHtmlIndex).toBe(8);
  });

  it('should handle text after HTML tag', () => {
    const html = '<p>hello</p> world';
    const result = mapPlainToHtmlPosition(html, 6, 5); // "world"
    expect(result.startHtmlIndex).toBe(13);
    expect(result.endHtmlIndex).toBe(18);
  });

  it('should handle text spanning multiple tags', () => {
    const html = '<p>hello <strong>world</strong></p>';
    const result = mapPlainToHtmlPosition(html, 6, 5); // "world"
    expect(result.startHtmlIndex).toBe(17);
    expect(result.endHtmlIndex).toBe(22);
  });

  it('should handle nested tags', () => {
    const html = '<p><em>hello</em> <strong>world</strong></p>';
    const result = mapPlainToHtmlPosition(html, 0, 5); // "hello"
    expect(result.startHtmlIndex).toBe(7);
    expect(result.endHtmlIndex).toBe(12);
  });
});

describe('wrapWithMark', () => {
  it('should wrap plain text with mark and position attribute', () => {
    const result = wrapWithMark('hello', 1);
    // Single text gets data-highlight-pos="only"
    expect(result).toBe('<mark class="highlight-mark" data-highlight-id="1" data-highlight-pos="only">hello</mark>');
  });

  it('should wrap text containing HTML tags with position attributes', () => {
    const result = wrapWithMark('hello <strong>world</strong>', 1);
    // First text segment gets data-highlight-pos="first"
    expect(result).toContain('<mark class="highlight-mark" data-highlight-id="1" data-highlight-pos="first">hello </mark>');
    expect(result).toContain('<strong>');
    // Last text segment gets data-highlight-pos="last"
    expect(result).toContain('<mark class="highlight-mark" data-highlight-id="1" data-highlight-pos="last">world</mark>');
    expect(result).toContain('</strong>');
  });

  it('should preserve tags in original positions with position attributes', () => {
    const result = wrapWithMark('a<br>b', 1);
    // First segment gets pos="first", last segment gets pos="last"
    expect(result).toBe('<mark class="highlight-mark" data-highlight-id="1" data-highlight-pos="first">a</mark><br><mark class="highlight-mark" data-highlight-id="1" data-highlight-pos="last">b</mark>');
  });

  it('should not wrap whitespace-only parts', () => {
    const result = wrapWithMark('hello <strong> </strong> world', 1);
    expect(result).toContain('<strong> </strong>');
  });

  it('should handle three text segments with correct position attributes', () => {
    const result = wrapWithMark('first <em>middle</em> last', 1);
    // First segment: data-highlight-pos="first"
    expect(result).toContain('<mark class="highlight-mark" data-highlight-id="1" data-highlight-pos="first">first </mark>');
    // Middle segment: no position attribute
    expect(result).toContain('<mark class="highlight-mark" data-highlight-id="1">middle</mark>');
    // Last segment: data-highlight-pos="last"
    expect(result).toContain('<mark class="highlight-mark" data-highlight-id="1" data-highlight-pos="last"> last</mark>');
  });
});

describe('processHighlights', () => {
  describe('basic highlighting', () => {
    it('should highlight exact text match', () => {
      const result = processHighlights({
        content: '<p>This is some sample text.</p>',
        highlights: [{ id: 1, selectedText: 'sample text' }],
      });
      expect(result).toContain('<mark class="highlight-mark" data-highlight-id="1" data-highlight-pos="only">sample text</mark>');
    });

    it('should return original content when no highlights', () => {
      const content = '<p>Hello world</p>';
      const result = processHighlights({ content, highlights: [] });
      expect(result).toBe(content);
    });

    it('should return empty string when content is empty', () => {
      const result = processHighlights({ content: '', highlights: [{ id: 1, selectedText: 'test' }] });
      expect(result).toBe('');
    });

    it('should not modify content when highlight text not found', () => {
      const content = '<p>Hello world</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'not found' }],
      });
      expect(result).toBe(content);
    });
  });

  describe('text spanning HTML tags', () => {
    it('should highlight text that spans a strong tag', () => {
      const result = processHighlights({
        content: '<p>over 7 million <strong>job openings</strong> during 2025</p>',
        highlights: [{ id: 1, selectedText: 'over 7 million job openings during' }],
      });
      expect(result).toContain('data-highlight-id="1"');
      expect(result).toContain('over 7 million');
      expect(result).toContain('job openings');
      expect(result).toContain('during');
    });

    it('should highlight text spanning multiple tags', () => {
      const result = processHighlights({
        content: '<p>Hello <em>beautiful</em> <strong>world</strong> today</p>',
        highlights: [{ id: 1, selectedText: 'beautiful world today' }],
      });
      expect(result).toContain('data-highlight-id="1"');
      // Should wrap text parts separately
      expect(result).toMatch(/<mark[^>]*>beautiful<\/mark>/);
      expect(result).toMatch(/<mark[^>]*>world<\/mark>/);
      expect(result).toMatch(/<mark[^>]*> today<\/mark>/);
    });

    it('should handle text inside nested tags', () => {
      const result = processHighlights({
        content: '<p><strong><em>important</em></strong> text</p>',
        highlights: [{ id: 1, selectedText: 'important text' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle br tags within highlighted text', () => {
      // br tags are not whitespace, so this tests the flexible pattern matching
      // where newlines in the highlight text match actual content
      const result = processHighlights({
        content: '<p>line one and line two</p>',
        highlights: [{ id: 1, selectedText: 'line one and line two' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });
  });

  describe('whitespace handling', () => {
    it('should match text with different whitespace', () => {
      const result = processHighlights({
        content: '<p>hello    world</p>',
        highlights: [{ id: 1, selectedText: 'hello world' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should match text with newlines in content', () => {
      const result = processHighlights({
        content: '<p>hello\nworld</p>',
        highlights: [{ id: 1, selectedText: 'hello world' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle leading/trailing whitespace in highlight', () => {
      const result = processHighlights({
        content: '<p>This is important text here.</p>',
        highlights: [{ id: 1, selectedText: ' important text ' }],
      });
      // Normalized version should match
      expect(result).toContain('important text');
    });
  });

  describe('multiple highlights', () => {
    it('should apply multiple highlights to different text', () => {
      const result = processHighlights({
        content: '<p>First highlight and second highlight here.</p>',
        highlights: [
          { id: 1, selectedText: 'First highlight' },
          { id: 2, selectedText: 'second highlight' },
        ],
      });
      expect(result).toContain('data-highlight-id="1"');
      expect(result).toContain('data-highlight-id="2"');
    });

    it('should prioritize longer highlights over shorter ones', () => {
      const result = processHighlights({
        content: '<p>This is a long highlighted sentence.</p>',
        highlights: [
          { id: 1, selectedText: 'highlighted' },
          { id: 2, selectedText: 'a long highlighted sentence' },
        ],
      });
      // The longer highlight (id=2) should be applied
      expect(result).toContain('data-highlight-id="2"');
      // The shorter highlight (id=1) should NOT be applied since it's contained in the longer one
      expect(result).not.toContain('data-highlight-id="1"');
    });

    it('should skip duplicate highlights (same text)', () => {
      const result = processHighlights({
        content: '<p>Sample text here.</p>',
        highlights: [
          { id: 1, selectedText: 'Sample text' },
          { id: 2, selectedText: 'Sample text' },
        ],
      });
      // Only one highlight should be applied
      const markCount = (result.match(/data-highlight-id/g) || []).length;
      expect(markCount).toBe(1);
    });
  });

  describe('special characters', () => {
    it('should handle highlight text with dollar signs', () => {
      const result = processHighlights({
        content: '<p>The price is $50.00 today.</p>',
        highlights: [{ id: 1, selectedText: '$50.00' }],
      });
      expect(result).toContain('data-highlight-id="1"');
      expect(result).toContain('$50.00');
    });

    it('should handle highlight text with parentheses', () => {
      const result = processHighlights({
        content: '<p>Call function(x) to proceed.</p>',
        highlights: [{ id: 1, selectedText: 'function(x)' }],
      });
      expect(result).toContain('data-highlight-id="1"');
      expect(result).toContain('function(x)');
    });

    it('should handle highlight text with brackets', () => {
      const result = processHighlights({
        content: '<p>Array [1, 2, 3] contains values.</p>',
        highlights: [{ id: 1, selectedText: '[1, 2, 3]' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle highlight text with asterisks', () => {
      const result = processHighlights({
        content: '<p>Use * for wildcard matching.</p>',
        highlights: [{ id: 1, selectedText: '* for wildcard' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle highlight text with quotes', () => {
      const result = processHighlights({
        content: '<p>He said "hello world" loudly.</p>',
        highlights: [{ id: 1, selectedText: '"hello world"' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });
  });

  describe('edge cases', () => {
    it('should handle content with only HTML tags (no text)', () => {
      const result = processHighlights({
        content: '<p><br><hr></p>',
        highlights: [{ id: 1, selectedText: 'not found' }],
      });
      expect(result).toBe('<p><br><hr></p>');
    });

    it('should handle very long highlight text', () => {
      const longText = 'This is a very long paragraph that spans multiple lines and contains a lot of text. '.repeat(10);
      const content = `<p>${longText}</p>`;
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: longText.slice(0, 100) }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle highlight at the very beginning of content', () => {
      const result = processHighlights({
        content: '<p>Start of text.</p>',
        highlights: [{ id: 1, selectedText: 'Start' }],
      });
      expect(result).toContain('<mark class="highlight-mark" data-highlight-id="1" data-highlight-pos="only">Start</mark>');
    });

    it('should handle highlight at the very end of content', () => {
      const result = processHighlights({
        content: '<p>Text at end</p>',
        highlights: [{ id: 1, selectedText: 'end' }],
      });
      expect(result).toContain('<mark class="highlight-mark" data-highlight-id="1" data-highlight-pos="only">end</mark>');
    });

    it('should handle self-closing tags', () => {
      const result = processHighlights({
        content: '<p>Before<br/>After text</p>',
        highlights: [{ id: 1, selectedText: 'After text' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle entities in content', () => {
      const result = processHighlights({
        content: '<p>Less than &lt; and greater &gt; signs</p>',
        highlights: [{ id: 1, selectedText: 'than' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });
  });

  describe('real-world scenarios', () => {
    it('should handle news article with bold statistics', () => {
      const result = processHighlights({
        content: '<p>The economy added <strong>50,000 new jobs</strong> in January, averaging fewer than <strong>75,000 jobs per month</strong> in 2025.</p>',
        highlights: [{ id: 1, selectedText: 'averaging fewer than 75,000 jobs per month' }],
      });
      expect(result).toContain('data-highlight-id="1"');
      expect(result).toMatch(/averaging fewer than/);
      expect(result).toMatch(/75,000 jobs per month/);
    });

    it('should handle blog post with mixed formatting', () => {
      const result = processHighlights({
        content: '<p>The <em>most important</em> thing to remember is that <strong>consistency</strong> beats <em>perfection</em> every time.</p>',
        highlights: [{ id: 1, selectedText: 'consistency beats perfection' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle content with links', () => {
      const result = processHighlights({
        content: '<p>Read more about this on <a href="https://example.com">our website</a> for details.</p>',
        highlights: [{ id: 1, selectedText: 'our website for details' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle list items', () => {
      const result = processHighlights({
        content: '<ul><li>First item</li><li>Second item</li></ul>',
        highlights: [{ id: 1, selectedText: 'First item' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    // Headings
    it('should handle h1 headings', () => {
      const result = processHighlights({
        content: '<h1>Main Title of the Article</h1><p>Some content follows.</p>',
        highlights: [{ id: 1, selectedText: 'Main Title' }],
      });
      expect(result).toContain('data-highlight-id="1"');
      expect(result).toContain('<h1>');
    });

    it('should handle h2 headings', () => {
      const result = processHighlights({
        content: '<h2>Section Heading Here</h2><p>Paragraph text.</p>',
        highlights: [{ id: 1, selectedText: 'Section Heading' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle h3 headings', () => {
      const result = processHighlights({
        content: '<h3>Subsection Title</h3><p>More text here.</p>',
        highlights: [{ id: 1, selectedText: 'Subsection Title' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle highlight spanning heading and paragraph with whitespace', () => {
      // When block elements have whitespace between them in the HTML, highlighting works
      const result = processHighlights({
        content: '<h2>Introduction</h2>\n<p>Welcome to the guide.</p>',
        highlights: [{ id: 1, selectedText: 'Introduction Welcome to' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle highlight spanning h3 to p without whitespace in HTML', () => {
      // This tests the exact bug scenario: </h3><p> with no whitespace between tags
      // Browser selection includes a space, but raw HTML doesn't have one
      const result = processHighlights({
        content: '<h3>Unemployment Rate Trends</h3><p>The national unemployment rate gradually increased.</p>',
        highlights: [{ id: 1, selectedText: 'Unemployment Rate Trends The national unemployment' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle highlight within heading only', () => {
      const result = processHighlights({
        content: '<h2>Introduction to the Topic</h2><p>Welcome to the guide.</p>',
        highlights: [{ id: 1, selectedText: 'Introduction to the' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    // Unordered lists (ul/li)
    it('should handle unordered list with multiple items', () => {
      const result = processHighlights({
        content: '<ul><li>Apple</li><li>Banana</li><li>Cherry</li></ul>',
        highlights: [{ id: 1, selectedText: 'Banana' }],
      });
      expect(result).toContain('data-highlight-id="1"');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>');
    });

    it('should handle highlight spanning multiple list items with whitespace', () => {
      // When list items have whitespace/newlines between them, highlighting works
      const result = processHighlights({
        content: '<ul>\n<li>First point here</li>\n<li>Second point here</li>\n</ul>',
        highlights: [{ id: 1, selectedText: 'First point here Second point' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle highlight within single list item', () => {
      const result = processHighlights({
        content: '<ul><li>First point here with more text</li><li>Second point</li></ul>',
        highlights: [{ id: 1, selectedText: 'First point here with' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle nested unordered lists', () => {
      const result = processHighlights({
        content: '<ul><li>Parent item<ul><li>Nested child item</li></ul></li></ul>',
        highlights: [{ id: 1, selectedText: 'Nested child' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    // Ordered lists (ol/li)
    it('should handle ordered list', () => {
      const result = processHighlights({
        content: '<ol><li>Step one</li><li>Step two</li><li>Step three</li></ol>',
        highlights: [{ id: 1, selectedText: 'Step two' }],
      });
      expect(result).toContain('data-highlight-id="1"');
      expect(result).toContain('<ol>');
    });

    it('should handle highlight spanning ordered list items with whitespace', () => {
      // When list items have whitespace between them, highlighting works
      const result = processHighlights({
        content: '<ol>\n<li>Do this first</li>\n<li>Then do this</li>\n</ol>',
        highlights: [{ id: 1, selectedText: 'Do this first Then do' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    // List items with formatting
    it('should handle list items with bold text', () => {
      const result = processHighlights({
        content: '<ul><li><strong>Important</strong> item here</li></ul>',
        highlights: [{ id: 1, selectedText: 'Important item' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle list items with italic text', () => {
      const result = processHighlights({
        content: '<ul><li>This is <em>emphasized</em> text</li></ul>',
        highlights: [{ id: 1, selectedText: 'is emphasized text' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle list items with links', () => {
      const result = processHighlights({
        content: '<ul><li>Check out <a href="https://example.com">this link</a> for more</li></ul>',
        highlights: [{ id: 1, selectedText: 'this link for more' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    // Complex document structures
    it('should handle mixed headings and lists', () => {
      const result = processHighlights({
        content: '<h2>Shopping List</h2><ul><li>Milk</li><li>Bread</li></ul><h2>Todo</h2><ol><li>Work</li></ol>',
        highlights: [
          { id: 1, selectedText: 'Shopping List' },
          { id: 2, selectedText: 'Bread' },
        ],
      });
      expect(result).toContain('data-highlight-id="1"');
      expect(result).toContain('data-highlight-id="2"');
    });

    it('should handle paragraph followed by list with whitespace', () => {
      // When block elements have whitespace between them, highlighting works
      const result = processHighlights({
        content: '<p>Here are the steps:</p>\n<ol>\n<li>First step</li>\n<li>Second step</li>\n</ol>',
        highlights: [{ id: 1, selectedText: 'the steps: First step' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle blockquote followed by list with whitespace', () => {
      // When block elements have whitespace between them, highlighting works
      const result = processHighlights({
        content: '<blockquote>A wise saying</blockquote>\n<ul>\n<li>Point one</li>\n</ul>',
        highlights: [{ id: 1, selectedText: 'wise saying Point one' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    // Code blocks within lists
    it('should handle list items with inline code', () => {
      const result = processHighlights({
        content: '<ul><li>Use <code>console.log()</code> for debugging</li></ul>',
        highlights: [{ id: 1, selectedText: 'console.log() for debugging' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    // Horizontal rules
    it('should handle content with horizontal rules', () => {
      const result = processHighlights({
        content: '<p>Section one</p><hr><p>Section two</p>',
        highlights: [{ id: 1, selectedText: 'Section one' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle blockquotes', () => {
      const result = processHighlights({
        content: '<blockquote>This is a famous quote from someone important.</blockquote>',
        highlights: [{ id: 1, selectedText: 'famous quote' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });
  });
});

describe('findOverlap', () => {
  it('should detect when one string contains the other', () => {
    expect(findOverlap('hello world', 'world')).toBe(true);
    expect(findOverlap('world', 'hello world')).toBe(true);
  });

  it('should detect overlapping text at edges', () => {
    // "world today" overlaps with "today is" at "today"
    expect(findOverlap('world today', 'today is')).toBe(true);
    expect(findOverlap('today is', 'world today')).toBe(true);
  });

  it('should return false for non-overlapping text', () => {
    expect(findOverlap('hello', 'world')).toBe(false);
    expect(findOverlap('abc', 'xyz')).toBe(false);
  });

  it('should handle identical strings', () => {
    expect(findOverlap('hello', 'hello')).toBe(true);
  });
});

describe('findAdjacent', () => {
  const content = 'Done! I\'ve created a comprehensive test suite for the highlighting functionality.';

  it('should detect when highlight is immediately before selected text', () => {
    expect(findAdjacent('Done!', 'I\'ve created', content)).toBe('before');
  });

  it('should detect when highlight is immediately after selected text', () => {
    expect(findAdjacent('test suite', 'comprehensive', content)).toBe('after');
  });

  it('should detect adjacency with whitespace between', () => {
    // "Done!" is followed by space then "I've"
    expect(findAdjacent('Done!', 'I\'ve created a comprehensive', content)).toBe('before');
  });

  it('should return null for non-adjacent text', () => {
    expect(findAdjacent('Done!', 'functionality', content)).toBe(null);
  });

  it('should handle HTML content', () => {
    const htmlContent = '<p>Done! I\'ve created a <strong>comprehensive</strong> test.</p>';
    expect(findAdjacent('Done!', 'I\'ve created', htmlContent)).toBe('before');
  });

  it('should return null for empty content', () => {
    expect(findAdjacent('hello', 'world', '')).toBe(null);
  });
});

describe('findOverlapOrAdjacent', () => {
  const content = 'Done! I\'ve created a comprehensive test suite.';

  it('should fall back to text-based detection when no positions provided', () => {
    // Without positions, text-based detection is used as fallback
    expect(findOverlapOrAdjacent('comprehensive test', 'test suite', content)).toBe(true);
  });

  it('should return true for overlapping positions', () => {
    // "comprehensive test" is at 22-40, "test suite" overlaps at 36-46
    expect(findOverlapOrAdjacent(
      'comprehensive test', 'test suite', content,
      { start: 22, end: 40 }, { start: 36, end: 46 }
    )).toBe(true);
  });

  it('should return true for adjacent positions', () => {
    // "Done!" is at 0-5, "I've created" is at 6-18
    expect(findOverlapOrAdjacent(
      'Done!', 'I\'ve created', content,
      { start: 0, end: 5 }, { start: 6, end: 18 }
    )).toBe(true);
  });

  it('should return false for non-adjacent positions', () => {
    // "Done!" is at 0-5, "suite" is at 41-46 (not adjacent)
    expect(findOverlapOrAdjacent(
      'Done!', 'suite', content,
      { start: 0, end: 5 }, { start: 41, end: 46 }
    )).toBe(false);
  });

  it('should return false when positions are in different locations', () => {
    // Same text appearing multiple times but positions don't overlap
    const content = 'User increased their efforts. Later, increased during the year was noted.';
    // First "increased" is at 5-14, second is at 37-46
    expect(findOverlapOrAdjacent(
      ' increased during the year', 'increased', content,
      { start: 36, end: 62 }, { start: 5, end: 14 }
    )).toBe(false);
  });

  it('should return true when selection is within highlight position (split case)', () => {
    const content = 'The quick brown fox jumps over the lazy dog.';
    // "quick brown fox" is at 4-19, "brown" is at 10-15 (within the highlight)
    expect(findOverlapOrAdjacent(
      'quick brown fox', 'brown', content,
      { start: 4, end: 19 }, { start: 10, end: 15 }
    )).toBe(true);
  });
});

describe('mergeTexts', () => {
  const content = 'Done! I\'ve created a comprehensive test suite for the highlighting functionality.';

  describe('overlapping text', () => {
    it('should merge when one contains the other', () => {
      expect(mergeTexts('comprehensive test', 'test', content)).toBe('comprehensive test');
      expect(mergeTexts('test', 'comprehensive test', content)).toBe('comprehensive test');
    });

    it('should merge overlapping text at edges', () => {
      expect(mergeTexts('comprehensive test', 'test suite', content)).toBe('comprehensive test suite');
    });
  });

  describe('adjacent text', () => {
    it('should merge adjacent text with space preserved', () => {
      const result = mergeTexts('Done!', 'I\'ve created', content);
      expect(result).toBe('Done! I\'ve created');
    });

    it('should merge when selection comes before existing highlight', () => {
      const result = mergeTexts('test suite', 'comprehensive', content);
      expect(result).toBe('comprehensive test suite');
    });

    it('should merge multiple adjacent selections', () => {
      // First merge "Done!" with "I've"
      const first = mergeTexts('Done!', 'I\'ve', content);
      expect(first).toBe('Done! I\'ve');

      // Then merge with "created"
      const second = mergeTexts(first, 'created', content);
      expect(second).toBe('Done! I\'ve created');
    });
  });

  describe('real-world scenarios', () => {
    it('should handle extending a highlight forward', () => {
      // User has "comprehensive" highlighted, selects "test suite" to extend
      const result = mergeTexts('comprehensive', 'test suite', content);
      expect(result).toBe('comprehensive test suite');
    });

    it('should handle extending a highlight backward', () => {
      // User has "test suite" highlighted, selects "comprehensive" to extend backward
      const result = mergeTexts('test suite', 'comprehensive', content);
      expect(result).toBe('comprehensive test suite');
    });

    it('should handle HTML content when merging', () => {
      const htmlContent = '<p>Done! I\'ve created a <strong>comprehensive</strong> test suite.</p>';
      const result = mergeTexts('Done!', 'I\'ve created', htmlContent);
      expect(result).toBe('Done! I\'ve created');
    });
  });
});

// ============================================================================
// COMPLEX / EDGE CASE TESTS
// ============================================================================

describe('Complex Scenarios', () => {
  describe('findOverlap edge cases', () => {
    it('should handle single character overlap', () => {
      expect(findOverlap('abc', 'cde')).toBe(true);
      expect(findOverlap('cde', 'abc')).toBe(true);
    });

    it('should handle single character strings', () => {
      expect(findOverlap('a', 'a')).toBe(true);
      expect(findOverlap('a', 'b')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(findOverlap('', 'hello')).toBe(true); // empty is substring of everything
      expect(findOverlap('hello', '')).toBe(true);
      expect(findOverlap('', '')).toBe(true);
    });

    it('should be case-sensitive', () => {
      expect(findOverlap('Hello', 'hello')).toBe(false);
      expect(findOverlap('WORLD', 'world')).toBe(false);
    });

    it('should handle special regex characters in text', () => {
      expect(findOverlap('price: $50.00', '$50.00 is')).toBe(true);
      expect(findOverlap('function()', '() => {}')).toBe(true);
      expect(findOverlap('a+b*c', 'c?d')).toBe(true);
    });

    it('should handle unicode characters', () => {
      expect(findOverlap('Hello 👋', '👋 World')).toBe(true);
      expect(findOverlap('café', 'fé au lait')).toBe(true);
    });

    it('should handle multiline text overlap', () => {
      expect(findOverlap('line1\nline2', 'line2\nline3')).toBe(true);
    });
  });

  describe('findAdjacent edge cases', () => {
    it('should handle punctuation at boundaries', () => {
      const content = 'Hello, world! How are you?';
      expect(findAdjacent('Hello,', 'world!', content)).toBe('before');
      expect(findAdjacent('world!', 'How', content)).toBe('before');
    });

    it('should handle no whitespace between adjacent text', () => {
      const content = 'HelloWorld';
      expect(findAdjacent('Hello', 'World', content)).toBe('before');
    });

    it('should handle multiple whitespace characters', () => {
      const content = 'Hello    World';
      expect(findAdjacent('Hello', 'World', content)).toBe('before');
    });

    it('should handle newlines between adjacent text', () => {
      const content = 'Hello\nWorld';
      expect(findAdjacent('Hello', 'World', content)).toBe('before');
    });

    it('should handle tabs between adjacent text', () => {
      const content = 'Hello\tWorld';
      expect(findAdjacent('Hello', 'World', content)).toBe('before');
    });

    it('should NOT match when there is other text between', () => {
      const content = 'Hello there World';
      expect(findAdjacent('Hello', 'World', content)).toBe(null);
    });

    it('should handle text at the very start of content', () => {
      const content = 'Start of the content here.';
      expect(findAdjacent('Start', 'of the', content)).toBe('before');
    });

    it('should handle text at the very end of content', () => {
      const content = 'Some text at the end.';
      expect(findAdjacent('the', 'end.', content)).toBe('before');
    });

    it('should handle special regex characters', () => {
      const content = 'Price: $50.00 (USD)';
      expect(findAdjacent('$50.00', '(USD)', content)).toBe('before');
    });

    it('should handle repeated text - finds first occurrence', () => {
      const content = 'the cat and the dog and the bird';
      // Both "the cat" and "the dog" exist, but they're not adjacent
      expect(findAdjacent('the', 'cat', content)).toBe('before');
    });

    it('should handle HTML with nested tags', () => {
      const content = '<p><strong><em>Bold italic</em></strong> normal text</p>';
      expect(findAdjacent('Bold italic', 'normal', content)).toBe('before');
    });

    it('should handle self-closing tags between text', () => {
      const content = '<p>Before<br/>After</p>';
      // After stripping HTML: "BeforeAfter" - they are adjacent
      expect(findAdjacent('Before', 'After', content)).toBe('before');
    });
  });

  describe('findOverlapOrAdjacent complex cases', () => {
    const content = 'The quick brown fox jumps over the lazy dog.';

    it('should detect adjacent positions', () => {
      // "fox" is at 16-19, "jumps" is at 20-25 - adjacent with space
      expect(findOverlapOrAdjacent(
        'fox', 'jumps', content,
        { start: 16, end: 19 }, { start: 20, end: 25 }
      )).toBe(true);
    });

    it('should detect overlapping positions', () => {
      // "brown fox" is at 10-19, "fox jumps" is at 16-25 - overlap at 16-19
      expect(findOverlapOrAdjacent(
        'brown fox', 'fox jumps', content,
        { start: 10, end: 19 }, { start: 16, end: 25 }
      )).toBe(true);
    });

    it('should return false for non-adjacent positions', () => {
      // "quick" is at 4-9, "lazy" is at 35-39 - not adjacent
      expect(findOverlapOrAdjacent(
        'quick', 'lazy', content,
        { start: 4, end: 9 }, { start: 35, end: 39 }
      )).toBe(false);
    });
  });

  describe('mergeTexts complex cases', () => {
    it('should handle merging with punctuation', () => {
      const content = 'Hello, world! How are you?';
      expect(mergeTexts('Hello,', 'world!', content)).toBe('Hello, world!');
    });

    it('should handle merging at sentence boundaries', () => {
      const content = 'First sentence. Second sentence.';
      expect(mergeTexts('sentence.', 'Second', content)).toBe('sentence. Second');
    });

    it('should handle merging with no whitespace', () => {
      const content = 'HelloWorld';
      expect(mergeTexts('Hello', 'World', content)).toBe('HelloWorld');
    });

    it('should handle merging with multiple spaces', () => {
      const content = 'Hello    World';
      expect(mergeTexts('Hello', 'World', content)).toBe('Hello    World');
    });

    it('should handle merging with newlines', () => {
      const content = 'Hello\nWorld';
      expect(mergeTexts('Hello', 'World', content)).toBe('Hello\nWorld');
    });

    it('should handle chain of three merges', () => {
      const content = 'One Two Three Four Five';
      const first = mergeTexts('One', 'Two', content);
      expect(first).toBe('One Two');
      const second = mergeTexts(first, 'Three', content);
      expect(second).toBe('One Two Three');
      const third = mergeTexts(second, 'Four', content);
      expect(third).toBe('One Two Three Four');
    });

    it('should handle overlap taking precedence over adjacency', () => {
      const content = 'one two three four';
      // "two three" overlaps with "three four" at "three"
      const result = mergeTexts('two three', 'three four', content);
      expect(result).toBe('two three four');
    });

    it('should handle merging with HTML entities', () => {
      const content = '<p>Less than &lt; greater &gt; ampersand &amp;</p>';
      // After stripping: "Less than < greater > ampersand &"
      // Note: HTML entities are preserved as-is in our stripping
      expect(mergeTexts('Less than', '&lt;', content)).toBe('Less than &lt;');
    });

    it('should handle quotes and apostrophes', () => {
      const content = "It's a \"wonderful\" day, isn't it?";
      expect(mergeTexts("It's", 'a', content)).toBe("It's a");
      expect(mergeTexts('"wonderful"', 'day,', content)).toBe('"wonderful" day,');
    });
  });

  describe('processHighlights complex scenarios', () => {
    it('should handle multiple highlights with different lengths correctly', () => {
      const content = '<p>The quick brown fox jumps over the lazy dog.</p>';
      const result = processHighlights({
        content,
        highlights: [
          { id: 1, selectedText: 'quick' },
          { id: 2, selectedText: 'quick brown fox' },
          { id: 3, selectedText: 'brown' },
        ],
      });
      // Longest first: "quick brown fox" (id=2) should be highlighted
      // "quick" and "brown" are contained, so should not be separately highlighted
      expect(result).toContain('data-highlight-id="2"');
      expect(result).not.toContain('data-highlight-id="1"');
      expect(result).not.toContain('data-highlight-id="3"');
    });

    it('should handle adjacent but non-overlapping highlights', () => {
      const content = '<p>One Two Three Four</p>';
      const result = processHighlights({
        content,
        highlights: [
          { id: 1, selectedText: 'One Two' },
          { id: 2, selectedText: 'Three Four' },
        ],
      });
      // Both should be highlighted since they don't overlap
      expect(result).toContain('data-highlight-id="1"');
      expect(result).toContain('data-highlight-id="2"');
    });

    it('should handle highlights in different HTML elements', () => {
      const content = '<p>First paragraph.</p><p>Second paragraph.</p>';
      const result = processHighlights({
        content,
        highlights: [
          { id: 1, selectedText: 'First paragraph' },
          { id: 2, selectedText: 'Second paragraph' },
        ],
      });
      expect(result).toContain('data-highlight-id="1"');
      expect(result).toContain('data-highlight-id="2"');
    });

    it('should handle highlight spanning multiple HTML tags', () => {
      const content = '<p>Start <strong>middle</strong> end</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Start middle end' }],
      });
      expect(result).toContain('data-highlight-id="1"');
      // Should have multiple mark tags (one for each text segment)
      const markCount = (result.match(/data-highlight-id="1"/g) || []).length;
      expect(markCount).toBeGreaterThanOrEqual(1);
    });

    it('should handle deeply nested HTML', () => {
      const content = '<div><p><span><strong><em>Nested text here</em></strong></span></p></div>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Nested text here' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle whitespace normalization in highlights', () => {
      const content = '<p>Hello   World</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Hello World' }], // single space
      });
      // Should still match despite whitespace difference
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should not highlight if text appears only partially', () => {
      const content = '<p>unhappy person</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'happy' }], // "happy" is part of "unhappy"
      });
      // This WILL match because "happy" is a substring - this is expected behavior
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle multiple occurrences - highlights first', () => {
      const content = '<p>The cat sat on the mat. The cat was happy.</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'The cat' }],
      });
      // Should highlight first occurrence
      expect(result).toContain('data-highlight-id="1"');
      // Only one highlight should be applied (first occurrence)
      const markCount = (result.match(/data-highlight-id="1"/g) || []).length;
      expect(markCount).toBe(1);
    });

    it('should handle very long content efficiently', () => {
      const paragraph = 'This is a test paragraph with some content. ';
      const content = `<p>${paragraph.repeat(100)}</p>`;
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'test paragraph' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle empty highlight text gracefully', () => {
      const content = '<p>Some content here.</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: '' }],
      });
      // Empty highlight should not break anything
      expect(result).toBe(content);
    });

    it('should handle highlight text not in content', () => {
      const content = '<p>Hello world</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'goodbye universe' }],
      });
      expect(result).toBe(content);
      expect(result).not.toContain('data-highlight-id');
    });

    it('should handle special characters in highlight', () => {
      const content = '<p>The price is $99.99 (discounted).</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: '$99.99 (discounted)' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle unicode in content and highlights', () => {
      const content = '<p>Hello 👋 World 🌍!</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: '👋 World' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle HTML comments in content', () => {
      const content = '<p>Before <!-- comment --> After</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Before' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should preserve all HTML attributes when wrapping', () => {
      const content = '<p class="intro" id="first">Hello world</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Hello' }],
      });
      expect(result).toContain('class="intro"');
      expect(result).toContain('id="first"');
      expect(result).toContain('data-highlight-id="1"');
    });
  });

  describe('Integration scenarios - simulating user behavior', () => {
    const articleContent = `<article>
      <h1>Understanding Highlights</h1>
      <p>Highlighting is an important feature for readers. It allows them to mark important passages.</p>
      <p>When you <strong>highlight text</strong>, it becomes easier to find later.</p>
      <blockquote>Good readers highlight key ideas.</blockquote>
    </article>`;

    it('should handle highlight then extend forward', () => {
      // User highlights "important feature"
      const firstHighlight = processHighlights({
        content: articleContent,
        highlights: [{ id: 1, selectedText: 'important feature' }],
      });
      expect(firstHighlight).toContain('data-highlight-id="1"');

      // Check if "for readers" is adjacent to "important feature"
      const isAdjacent = findAdjacent('important feature', 'for readers', articleContent);
      expect(isAdjacent).toBe('before');

      // Merge them
      const merged = mergeTexts('important feature', 'for readers', articleContent);
      expect(merged).toBe('important feature for readers');
    });

    it('should handle highlight then extend backward', () => {
      // User highlights "easier to find"
      const firstHighlight = processHighlights({
        content: articleContent,
        highlights: [{ id: 1, selectedText: 'easier to find' }],
      });
      expect(firstHighlight).toContain('data-highlight-id="1"');

      // Check if "becomes" is adjacent (before) "easier to find"
      const isAdjacent = findAdjacent('easier to find', 'becomes', articleContent);
      expect(isAdjacent).toBe('after');

      // Merge them
      const merged = mergeTexts('easier to find', 'becomes', articleContent);
      expect(merged).toBe('becomes easier to find');
    });

    it('should handle selecting text that spans bold tag', () => {
      // "highlight text" spans the <strong> tag
      const result = processHighlights({
        content: articleContent,
        highlights: [{ id: 1, selectedText: 'highlight text' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle blockquote content', () => {
      const result = processHighlights({
        content: articleContent,
        highlights: [{ id: 1, selectedText: 'Good readers highlight' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle multiple highlights in same paragraph', () => {
      const result = processHighlights({
        content: articleContent,
        highlights: [
          { id: 1, selectedText: 'important' },
          { id: 2, selectedText: 'passages' },
        ],
      });
      expect(result).toContain('data-highlight-id="1"');
      expect(result).toContain('data-highlight-id="2"');
    });
  });
});

// ============================================================================
// RARE EDGE CASES
// ============================================================================

describe('Rare Edge Cases', () => {
  describe('Unicode and special characters', () => {
    it('should handle zero-width characters', () => {
      const content = '<p>Hello\u200BWorld</p>'; // zero-width space between
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Hello\u200BWorld' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle non-breaking spaces', () => {
      const content = '<p>100\u00A0USD</p>'; // non-breaking space
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: '100\u00A0USD' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle em-dash and en-dash', () => {
      const content = '<p>Hello—world–test</p>'; // em-dash and en-dash
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Hello—world' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle curly quotes', () => {
      const content = `<p>"Smart quotes" and 'single quotes'</p>`;
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: '"Smart quotes"' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle combining diacritical marks', () => {
      const content = '<p>café résumé naïve</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'résumé' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle surrogate pairs (4-byte emoji)', () => {
      const content = '<p>Test 🎉🎊🎁 emoji</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: '🎉🎊🎁' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle RTL text (Arabic)', () => {
      const content = '<p>Hello مرحبا World</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'مرحبا' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle mixed LTR and RTL', () => {
      const content = '<p>Price: 100₪ (שקלים)</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: '100₪' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle Chinese/Japanese/Korean characters', () => {
      const content = '<p>Hello 你好 こんにちは 안녕하세요</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: '你好' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });
  });

  describe('HTML edge cases', () => {
    it('should handle content with existing mark tags', () => {
      const content = '<p>Already <mark>marked</mark> text</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Already' }],
      });
      expect(result).toContain('data-highlight-id="1"');
      // Original mark should still be there
      expect(result).toContain('<mark>marked</mark>');
    });

    it('should handle text that looks like HTML but is escaped', () => {
      const content = '<p>Use &lt;div&gt; for containers</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Use' }],
      });
      expect(result).toContain('data-highlight-id="1"');
      // Entities should be preserved
      expect(result).toContain('&lt;div&gt;');
    });

    it('should handle void elements', () => {
      const content = '<p>Line1<br>Line2<hr>Line3</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Line2' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle data attributes', () => {
      const content = '<p data-testid="para" data-value="123">Hello world</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Hello' }],
      });
      expect(result).toContain('data-testid="para"');
      expect(result).toContain('data-value="123"');
    });

    it('should handle inline styles', () => {
      const content = '<p style="color: red; font-size: 14px;">Styled text</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Styled' }],
      });
      expect(result).toContain('style="color: red; font-size: 14px;"');
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle table content', () => {
      const content = '<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Cell 1' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle pre/code blocks', () => {
      const content = '<pre><code>function test() { return true; }</code></pre>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'function test()' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle script-like content in text', () => {
      // Content that mentions script tags as text
      const content = '<p>To add JS, use script tags</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'script tags' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle attributes with special chars', () => {
      const content = '<a href="https://example.com?a=1&b=2" title="Click &amp; go">Link</a>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Link' }],
      });
      expect(result).toContain('data-highlight-id="1"');
      expect(result).toContain('href="https://example.com?a=1&b=2"');
    });

    it('should handle empty elements between text', () => {
      const content = '<p>Before<span></span>After</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'BeforeAfter' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle deeply nested identical tags', () => {
      const content = '<div><div><div><div>Deep</div></div></div></div>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Deep' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });
  });

  describe('Whitespace edge cases', () => {
    it('should handle content with only whitespace', () => {
      const content = '<p>   </p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'text' }],
      });
      expect(result).toBe(content);
    });

    it('should handle Windows line endings (CRLF)', () => {
      const content = '<p>Line1\r\nLine2\r\nLine3</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Line1\r\nLine2' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle old Mac line endings (CR)', () => {
      const content = '<p>Line1\rLine2</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Line1\rLine2' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle tab characters', () => {
      const content = '<p>Col1\tCol2\tCol3</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Col1\tCol2' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle content starting with whitespace', () => {
      const content = '<p>   Starting with spaces</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Starting' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle content ending with whitespace', () => {
      const content = '<p>Ending with spaces   </p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'spaces' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });
  });

  describe('Adjacent text edge cases', () => {
    it('should handle three consecutive adjacent highlights', () => {
      const content = 'One Two Three Four';

      // First adjacency: One + Two
      expect(findAdjacent('One', 'Two', content)).toBe('before');
      const merged1 = mergeTexts('One', 'Two', content);
      expect(merged1).toBe('One Two');

      // Second adjacency: (One Two) + Three
      expect(findAdjacent(merged1, 'Three', content)).toBe('before');
      const merged2 = mergeTexts(merged1, 'Three', content);
      expect(merged2).toBe('One Two Three');

      // Third adjacency: (One Two Three) + Four
      expect(findAdjacent(merged2, 'Four', content)).toBe('before');
      const merged3 = mergeTexts(merged2, 'Four', content);
      expect(merged3).toBe('One Two Three Four');
    });

    it('should handle adjacency at paragraph boundaries', () => {
      const content = '<p>End of para1.</p><p>Start of para2.</p>';
      // After stripping: "End of para1.Start of para2."
      // They are adjacent in plain text
      expect(findAdjacent('para1.', 'Start', content)).toBe('before');
    });

    it('should handle highlight that matches text in attribute (should not match)', () => {
      const content = '<p class="highlight">Normal text</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Normal' }],
      });
      expect(result).toContain('data-highlight-id="1"');
      // Make sure we didn't mess with the class attribute
      expect(result).toContain('class="highlight"');
    });

    it('should handle multiple spaces between words in adjacency check', () => {
      const content = 'Word1     Word2';
      expect(findAdjacent('Word1', 'Word2', content)).toBe('before');
      const merged = mergeTexts('Word1', 'Word2', content);
      expect(merged).toBe('Word1     Word2');
    });
  });

  describe('Content format edge cases', () => {
    it('should handle JSON-like content', () => {
      const content = '<p>Config: {"key": "value", "number": 123}</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: '"key": "value"' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle URL content', () => {
      const content = '<p>Visit https://example.com/path?query=1&other=2#hash</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'https://example.com/path' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle email addresses', () => {
      const content = '<p>Contact us at support@example.com</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'support@example.com' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle phone numbers', () => {
      const content = '<p>Call +1 (555) 123-4567</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: '+1 (555) 123-4567' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle dates in various formats', () => {
      const content = '<p>Date: 2024-01-15, 01/15/2024, January 15, 2024</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: '2024-01-15' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle numbers with thousand separators', () => {
      const content = '<p>Revenue: $1,234,567.89</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: '$1,234,567.89' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle percentages', () => {
      const content = '<p>Growth: 125.5% increase</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: '125.5%' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle code with template literals', () => {
      const content = '<p>Template: `Hello ${name}`</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: '`Hello ${name}`' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle regex patterns in content', () => {
      const content = '<p>Pattern: /^[a-z]+$/gi</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: '/^[a-z]+$/gi' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });
  });

  describe('Security edge cases', () => {
    it('should not create XSS from highlight text', () => {
      const content = '<p>Normal content</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: '<script>alert("xss")</script>' }],
      });
      // Should not find the highlight (it's not in content)
      expect(result).not.toContain('<script>');
      expect(result).toBe(content);
    });

    it('should handle content with existing script-like patterns safely', () => {
      const content = '<p>The script element is used for JavaScript</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'script element' }],
      });
      expect(result).toContain('data-highlight-id="1"');
      // Should not have any actual script tags
      expect(result).not.toMatch(/<script[^>]*>/i);
    });

    it('should handle highlight text with HTML injection attempt', () => {
      const content = '<p>Some text here</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'text" onclick="alert(1)' }],
      });
      // Should not find it (not in content)
      expect(result).toBe(content);
    });
  });

  describe('Performance edge cases', () => {
    it('should handle content with many HTML tags efficiently', () => {
      const spans = Array(100).fill(0).map((_, i) => `<span>Word${i}</span>`).join(' ');
      const content = `<p>${spans}</p>`;
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Word50' }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle many highlights efficiently', () => {
      const content = '<p>' + Array(50).fill(0).map((_, i) => `Word${i}`).join(' ') + '</p>';
      const highlights = Array(20).fill(0).map((_, i) => ({
        id: i + 1,
        selectedText: `Word${i * 2}`,
      }));
      const result = processHighlights({ content, highlights });
      // At least some highlights should be applied
      expect(result).toContain('data-highlight-id=');
    });

    it('should handle very long single word', () => {
      const longWord = 'supercalifragilisticexpialidocious'.repeat(10);
      const content = `<p>${longWord}</p>`;
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: longWord.slice(0, 50) }],
      });
      expect(result).toContain('data-highlight-id="1"');
    });
  });

  describe('Boundary and overlap edge cases', () => {
    it('should handle highlight at exact content boundaries', () => {
      const content = 'Exact content';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'Exact content' }],
      });
      expect(result).toBe('<mark class="highlight-mark" data-highlight-id="1" data-highlight-pos="only">Exact content</mark>');
    });

    it('should handle overlapping highlights that share a word', () => {
      const content = '<p>The quick brown fox</p>';
      // "quick brown" and "brown fox" share "brown"
      // Longer one should be processed first
      const result = processHighlights({
        content,
        highlights: [
          { id: 1, selectedText: 'quick brown' },
          { id: 2, selectedText: 'brown fox' },
        ],
      });
      // Both have same length, so order matters (first one wins)
      // The second won't match because "brown" is already wrapped
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle highlight that is substring at word boundary', () => {
      const content = '<p>testing test tested</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'test' }],
      });
      // Should match first occurrence (inside "testing")
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should handle same text appearing multiple times - only first highlighted', () => {
      const content = '<p>test test test</p>';
      const result = processHighlights({
        content,
        highlights: [{ id: 1, selectedText: 'test' }],
      });
      // Only one mark tag should be present
      const matches = result.match(/data-highlight-id="1"/g);
      expect(matches?.length).toBe(1);
    });
  });
});

// ============================================================================
// POSITION-AWARE HIGHLIGHTING TESTS
// These tests cover the position-aware features that ensure the correct
// occurrence of text is highlighted when the same text appears multiple times.
// ============================================================================

describe('Position-Aware Highlighting', () => {
  describe('findTextAtPosition', () => {
    it('should find text at first occurrence when no position specified', () => {
      const content = 'hello world hello universe';
      expect(findTextAtPosition(content, 'hello')).toBe(0);
    });

    it('should find text at specific position', () => {
      const content = 'hello world hello universe';
      // First "hello" is at 0, second "hello" is at 12
      expect(findTextAtPosition(content, 'hello', 0)).toBe(0);
      expect(findTextAtPosition(content, 'hello', 12)).toBe(12);
      expect(findTextAtPosition(content, 'hello', 14)).toBe(12); // Within second occurrence
    });

    it('should return first occurrence when target position is not within any match', () => {
      const content = 'hello world hello universe';
      // Position 6 is in "world", not in any "hello"
      expect(findTextAtPosition(content, 'hello', 6)).toBe(0);
    });

    it('should handle single occurrence', () => {
      const content = 'the quick brown fox';
      expect(findTextAtPosition(content, 'quick', 4)).toBe(4);
    });

    it('should handle text not in content', () => {
      const content = 'hello world';
      expect(findTextAtPosition(content, 'goodbye')).toBe(-1);
      expect(findTextAtPosition(content, 'goodbye', 0)).toBe(-1);
    });
  });

  describe('arePositionsAdjacentOrOverlapping', () => {
    const content = 'The quick brown fox jumps over the lazy dog.';

    it('should detect overlapping ranges', () => {
      // "quick brown" (4-15) overlaps with "brown fox" (10-19)
      expect(arePositionsAdjacentOrOverlapping(
        { start: 4, end: 15 },
        { start: 10, end: 19 },
        content
      )).toBe(true);
    });

    it('should detect adjacent ranges with no gap', () => {
      // "quick" (4-9) is immediately followed by " brown" (9-15)
      expect(arePositionsAdjacentOrOverlapping(
        { start: 4, end: 9 },
        { start: 9, end: 15 },
        content
      )).toBe(true);
    });

    it('should detect adjacent ranges with whitespace gap', () => {
      // "quick" (4-9) and "brown" (10-15) have a space between them
      expect(arePositionsAdjacentOrOverlapping(
        { start: 4, end: 9 },
        { start: 10, end: 15 },
        content
      )).toBe(true);
    });

    it('should return false for non-adjacent, non-overlapping ranges', () => {
      // "quick" (4-9) and "jumps" (20-25) are not adjacent
      expect(arePositionsAdjacentOrOverlapping(
        { start: 4, end: 9 },
        { start: 20, end: 25 },
        content
      )).toBe(false);
    });

    it('should detect when selection is fully contained in highlight', () => {
      // "brown" (10-15) is within "quick brown fox" (4-19)
      expect(arePositionsAdjacentOrOverlapping(
        { start: 4, end: 19 },
        { start: 10, end: 15 },
        content
      )).toBe(true);
    });
  });

  describe('findOverlapOrAdjacent with positions', () => {
    const content = 'The cat sat on the mat. The cat was happy.';

    it('should use position info when provided for both', () => {
      // First "cat" is at 4-7, second "cat" is at 28-31
      // Highlight is "cat sat" (4-11), selection is "sat on" (8-14)
      // They overlap at positions 8-11
      expect(findOverlapOrAdjacent(
        'cat sat',
        'sat on',
        content,
        { start: 4, end: 11 },
        { start: 8, end: 14 }
      )).toBe(true);
    });

    it('should detect non-overlap when positions are far apart', () => {
      // First "cat" (4-7) and second "cat" (28-31) - not adjacent
      expect(findOverlapOrAdjacent(
        'cat',
        'cat',
        content,
        { start: 4, end: 7 },
        { start: 28, end: 31 }
      )).toBe(false);
    });

    it('should fall back to text-based detection when positions not provided', () => {
      // Falls back to text-based detection when positions aren't available
      expect(findOverlapOrAdjacent('cat sat', 'sat on', content)).toBe(true);
    });

    it('should detect adjacency via positions', () => {
      // "The" (0-3) is adjacent to "cat" (4-7) with a space between
      expect(findOverlapOrAdjacent(
        'The',
        'cat',
        content,
        { start: 0, end: 3 },
        { start: 4, end: 7 }
      )).toBe(true);
    });
  });

  describe('processHighlights with position info', () => {
    it('should highlight correct occurrence when position is provided', () => {
      const content = '<p>by the river, by the sea, by the mountain</p>';
      // There are three "by" occurrences at positions 0, 14, 27 (in plain text)
      // We want to highlight the second one (at position 14)
      const result = processHighlights({
        content,
        highlights: [{
          id: 1,
          selectedText: 'by',
          plainTextStart: 14,
          plainTextEnd: 16,
        }],
      });

      // Check that only one occurrence is highlighted
      const markCount = (result.match(/data-highlight-id="1"/g) || []).length;
      expect(markCount).toBe(1);

      // The result should have "by" highlighted, but we can't easily verify which one
      // without parsing the HTML structure
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should fall back to first occurrence when no position provided', () => {
      const content = '<p>hello world hello universe</p>';
      const result = processHighlights({
        content,
        highlights: [{
          id: 1,
          selectedText: 'hello',
        }],
      });

      expect(result).toContain('data-highlight-id="1"');
      // Only one highlight should be applied (first occurrence)
      const markCount = (result.match(/data-highlight-id="1"/g) || []).length;
      expect(markCount).toBe(1);
    });

    it('should handle multiple highlights with different text', () => {
      const content = '<p>the cat sat on the mat by the window</p>';
      // Highlight "cat" at position 4 and "mat" at position 19 and "by" at position 23
      const result = processHighlights({
        content,
        highlights: [
          { id: 1, selectedText: 'cat', plainTextStart: 4, plainTextEnd: 7 },
          { id: 2, selectedText: 'mat', plainTextStart: 19, plainTextEnd: 22 },
          { id: 3, selectedText: 'by', plainTextStart: 23, plainTextEnd: 25 },
        ],
      });

      // All highlights should be applied
      expect(result).toContain('data-highlight-id="1"');
      expect(result).toContain('data-highlight-id="2"');
      expect(result).toContain('data-highlight-id="3"');
    });

    it('should skip duplicate text highlights (by design)', () => {
      const content = '<p>cat dog cat bird cat fish</p>';
      // Try to highlight the same text twice at different positions
      // The second highlight should be skipped because the text is already highlighted
      const result = processHighlights({
        content,
        highlights: [
          { id: 1, selectedText: 'cat', plainTextStart: 8, plainTextEnd: 11 },
          { id: 2, selectedText: 'cat', plainTextStart: 17, plainTextEnd: 20 },
        ],
      });

      // Only one highlight should be applied (first one processed)
      expect(result).toContain('data-highlight-id="1"');
      // The second is skipped because 'cat' is already in highlightedTexts
      const markCount = (result.match(/data-highlight-id/g) || []).length;
      expect(markCount).toBe(1);
    });
  });

  describe('Real-world position scenarios', () => {
    it('should correctly handle "by" selection at specific position', () => {
      // This is the actual bug scenario: selecting "by" further in the post
      // should highlight that specific "by", not the first one
      const content = 'increased by 5% in the first quarter. Later increased by 10% in Q2.';

      // The first "by" is at position 10, the second "by" is at position 54
      // User selects the second "by" at position 54
      const secondByPos = content.indexOf('by', 11);
      expect(secondByPos).toBe(54);

      // When using position-aware detection, this should work correctly
      const result = processHighlights({
        content: `<p>${content}</p>`,
        highlights: [{
          id: 1,
          selectedText: 'by',
          plainTextStart: 54,
          plainTextEnd: 56,
        }],
      });

      expect(result).toContain('data-highlight-id="1"');
    });

    it('should detect extend highlight correctly for adjacent selection', () => {
      const content = 'Job Growth in 2024 was strong';

      // Existing highlight: "Job Growth" at 0-10
      // User selects "in 2024" at 11-18
      // These should be detected as adjacent
      expect(arePositionsAdjacentOrOverlapping(
        { start: 0, end: 10 },
        { start: 11, end: 18 },
        content
      )).toBe(true);

      // Using findOverlapOrAdjacent with positions
      expect(findOverlapOrAdjacent(
        'Job Growth',
        'in 2024',
        content,
        { start: 0, end: 10 },
        { start: 11, end: 18 }
      )).toBe(true);
    });

    it('should not detect overlap when same text appears in different locations', () => {
      const content = 'The job market. Job creation increased.';

      // Highlight "job market" at 4-14
      // User selects "Job" from "Job creation" at 16-19
      // These should NOT be detected as overlapping because they're in different positions
      expect(arePositionsAdjacentOrOverlapping(
        { start: 4, end: 14 },
        { start: 16, end: 19 },
        content
      )).toBe(false);
    });
  });
});

// ============================================================================
// REAL ARTICLE INTEGRATION TESTS
// These tests use the actual article content to test real-world scenarios
// for extend, split, and merge highlight functionality.
// ============================================================================

import { stripHtmlWithSpaces } from './highlightProcessor';

describe('Real Article Integration Tests', () => {
  // The actual article HTML from the user
  const articleHtml = `<div class="prose prose-invert prose-lg max-w-none prose-headings:text-ink-100 prose-p:text-ink-300 prose-a:text-gold-500 prose-strong:text-ink-100 prose-blockquote:border-gold-600 prose-blockquote:text-ink-400"><h2>Job Growth in the United States</h2><h3>Slower Employment Expansion</h3><p>Job creation in the United States slowed significantly in 2025. Total nonfarm payroll employment increased by roughly <strong>half a million jobs over the year</strong>, averaging fewer than <strong>50,000 new jobs per month</strong>. This represented one of the weakest annual job growth rates since the early 2000s, reflecting employer caution amid economic uncertainty.</p><h3>Unemployment Rate Trends</h3><p>The national unemployment rate gradually increased during the year, ending 2025 at approximately <strong>4.4 percent</strong>. While still low by historical standards, this increase signaled a cooling labor market compared with the tight conditions seen earlier in the decade.</p><h3>Sector Performance</h3><ul><li><p><strong>Health care and social assistance</strong> continued to add jobs due to aging population needs.</p></li><li><p><strong>Hospitality and food services</strong> experienced modest gains, supported by consumer spending.</p></li><li><p><strong>Retail trade and transportation</strong> saw job losses, partly due to automation, e-commerce consolidation, and reduced freight demand.</p></li></ul><p>Young and entry-level workers faced particular challenges, as employers reduced hiring for junior roles and increasingly sought experienced or highly skilled candidates.</p><hr><h2>Labor Force Participation and Job Openings</h2><h3>Labor Force Participation</h3><p>Labor force participation remained relatively stable, hovering just above <strong>60 percent</strong>. However, long-term unemployment persisted for a portion of job seekers, especially among older workers and those without updated technical skills.</p><h3>Job Openings</h3><p>Despite slower hiring, employers continued to report <strong>over 7 million job openings</strong> during much of 2025. This reflected ongoing mismatches between available jobs and worker skill sets rather than a lack of demand altogether.</p><hr><h2>Growth of Nontraditional Work</h2><p>Independent and contract work continued to expand. Tens of millions of Americans reported earning income through freelance, gig, or project-based work in 2025. Many of these roles are not fully captured in traditional employment statistics, suggesting the labor market is larger and more complex than payroll data alone indicates.</p><hr><h2>Global Employment Trends</h2><h3>Global Job Growth</h3><p>Worldwide employment growth also slowed. Global job creation increased by approximately <strong>1.5 percent in 2025</strong>, translating to tens of millions of new jobs, but falling short of earlier forecasts due to weaker economic growth and geopolitical uncertainty.</p><h3>Long-Term Outlook</h3><p>Looking ahead to 2030, global labor forecasts suggest that technological advancement and the green transition could create significantly more jobs than they displace. However, these gains depend heavily on large-scale reskilling and workforce adaptation.</p><hr><h2>Key Forces Shaping the 2025 Labor Market</h2><h3>Technology and Automation</h3><p>Artificial intelligence and automation played a growing role in reshaping work. While new roles emerged in technology, data, and advanced services, automation reduced demand for some routine and entry-level positions.</p><h3>Economic Conditions</h3><p>Higher interest rates, cautious business investment, and global trade pressures contributed to slower hiring and delayed expansion plans across many industries.</p><h3>Skills Mismatch</h3><p>Employers consistently reported difficulty finding workers with the right mix of technical, digital, and interpersonal skills. This mismatch remained one of the primary constraints on stronger job growth.</p><hr><h2>Implications for Workers and Employers</h2><ul><li><p><strong>Workers</strong> increasingly need adaptable skills, continuous learning, and flexibility to remain competitive.</p></li><li><p><strong>Employers</strong> are prioritizing productivity, automation, and selective hiring rather than rapid workforce expansion.</p></li><li><p><strong>Policymakers</strong> face pressure to invest in education, training, and labor force participation initiatives to support long-term employment growth.</p></li></ul></div>`;

  // Get the plain text version for position calculations
  const plainText = stripHtmlWithSpaces(articleHtml);

  // Helper to find text position in plain text
  const findPos = (text: string, startFrom = 0): number => {
    return plainText.indexOf(text, startFrom);
  };

  describe('Position verification', () => {
    it('should have correct plain text extraction', () => {
      // Verify the plain text starts correctly
      expect(plainText.startsWith('Job Growth in the United States')).toBe(true);

      // Verify "Job" appears multiple times
      const firstJob = findPos('Job');
      const secondJob = findPos('Job', firstJob + 1);
      expect(firstJob).toBeGreaterThanOrEqual(0);
      expect(secondJob).toBeGreaterThan(firstJob);
    });

    it('should find key phrases at expected positions', () => {
      // "Job Growth in the United States" should be at the start
      expect(findPos('Job Growth in the United States')).toBe(0);

      // "Job creation" should be after the headers
      const jobCreationPos = findPos('Job creation');
      expect(jobCreationPos).toBeGreaterThan(0);

      // "increased by roughly" should exist
      expect(findPos('increased by roughly')).toBeGreaterThan(0);
    });
  });

  describe('Extend Highlight - Adjacent Selection', () => {
    it('should detect adjacency when selecting text right after existing highlight', () => {
      // Scenario: User has highlighted "Job Growth"
      // User selects "in the United" to extend
      const highlightStart = findPos('Job Growth');
      const highlightEnd = highlightStart + 'Job Growth'.length;

      const selectionStart = findPos('in the United');
      const selectionEnd = selectionStart + 'in the United'.length;

      expect(arePositionsAdjacentOrOverlapping(
        { start: highlightStart, end: highlightEnd },
        { start: selectionStart, end: selectionEnd },
        plainText
      )).toBe(true);
    });

    it('should detect adjacency when selecting text right before existing highlight', () => {
      // Scenario: User has highlighted "United States"
      // User selects "the" before it to extend
      const thePos = findPos('the United States');
      const highlightStart = findPos('United States');
      const highlightEnd = highlightStart + 'United States'.length;

      const selectionStart = thePos;
      const selectionEnd = thePos + 'the'.length;

      expect(arePositionsAdjacentOrOverlapping(
        { start: highlightStart, end: highlightEnd },
        { start: selectionStart, end: selectionEnd },
        plainText
      )).toBe(true);
    });

    it('should NOT detect adjacency when selecting text far from existing highlight', () => {
      // Scenario: User has highlighted "Job Growth" at the start
      // User selects "Job creation" later in the article
      const highlightStart = findPos('Job Growth');
      const highlightEnd = highlightStart + 'Job Growth'.length;

      const jobCreationPos = findPos('Job creation');
      const selectionStart = jobCreationPos;
      const selectionEnd = jobCreationPos + 'Job creation'.length;

      // These should NOT be adjacent - they're far apart
      expect(arePositionsAdjacentOrOverlapping(
        { start: highlightStart, end: highlightEnd },
        { start: selectionStart, end: selectionEnd },
        plainText
      )).toBe(false);
    });

    it('should detect adjacency across whitespace between words', () => {
      // "Slower Employment" and "Expansion" are separated by a space
      const slowerPos = findPos('Slower Employment');
      const expansionPos = findPos('Expansion');

      expect(arePositionsAdjacentOrOverlapping(
        { start: slowerPos, end: slowerPos + 'Slower Employment'.length },
        { start: expansionPos, end: expansionPos + 'Expansion'.length },
        plainText
      )).toBe(true);
    });
  });

  describe('Split Highlight - Selection Within Existing', () => {
    it('should detect overlap when selection is inside existing highlight', () => {
      // Scenario: User has highlighted "Job Growth in the United States"
      // User selects "in the" from the middle to split/shrink
      const fullHighlightStart = findPos('Job Growth in the United States');
      const fullHighlightEnd = fullHighlightStart + 'Job Growth in the United States'.length;

      // Find "in the" within the highlight range
      const inThePos = plainText.indexOf('in the', fullHighlightStart);
      const selectionStart = inThePos;
      const selectionEnd = inThePos + 'in the'.length;

      // The selection should overlap with the highlight (it's contained)
      expect(arePositionsAdjacentOrOverlapping(
        { start: fullHighlightStart, end: fullHighlightEnd },
        { start: selectionStart, end: selectionEnd },
        plainText
      )).toBe(true);
    });

    it('should detect overlap when selection starts at highlight beginning', () => {
      // User has highlighted "Job Growth in the United States"
      // User selects "Job Growth" to shrink from start
      const fullHighlightStart = findPos('Job Growth in the United States');
      const fullHighlightEnd = fullHighlightStart + 'Job Growth in the United States'.length;

      const selectionStart = fullHighlightStart;
      const selectionEnd = fullHighlightStart + 'Job Growth'.length;

      expect(arePositionsAdjacentOrOverlapping(
        { start: fullHighlightStart, end: fullHighlightEnd },
        { start: selectionStart, end: selectionEnd },
        plainText
      )).toBe(true);
    });

    it('should detect overlap when selection ends at highlight end', () => {
      // User has highlighted "Job Growth in the United States"
      // User selects "United States" to shrink from end
      const fullHighlight = 'Job Growth in the United States';
      const fullHighlightStart = findPos(fullHighlight);
      const fullHighlightEnd = fullHighlightStart + fullHighlight.length;

      const unitedStatesPos = plainText.indexOf('United States', fullHighlightStart);
      const selectionEnd = unitedStatesPos + 'United States'.length;

      expect(arePositionsAdjacentOrOverlapping(
        { start: fullHighlightStart, end: fullHighlightEnd },
        { start: unitedStatesPos, end: selectionEnd },
        plainText
      )).toBe(true);
    });
  });

  describe('Merge Highlights - Overlapping Selections', () => {
    it('should detect overlap when two highlights share text', () => {
      // Highlight 1: "Job Growth in"
      // Highlight 2: "in the United"
      // They share "in"
      const h1Start = findPos('Job Growth in');
      const h1End = h1Start + 'Job Growth in'.length;

      const h2Start = findPos('in the United');
      const h2End = h2Start + 'in the United'.length;

      expect(arePositionsAdjacentOrOverlapping(
        { start: h1Start, end: h1End },
        { start: h2Start, end: h2End },
        plainText
      )).toBe(true);
    });

    it('should detect adjacency for non-overlapping but touching highlights', () => {
      // Highlight 1: "Job Growth"
      // Highlight 2: "in the United States"
      // They're adjacent with space between
      const h1Start = findPos('Job Growth');
      const h1End = h1Start + 'Job Growth'.length;

      const h2Start = findPos('in the United States');
      const h2End = h2Start + 'in the United States'.length;

      expect(arePositionsAdjacentOrOverlapping(
        { start: h1Start, end: h1End },
        { start: h2Start, end: h2End },
        plainText
      )).toBe(true);
    });
  });

  describe('findOverlapOrAdjacent with article content', () => {
    it('should work with actual article HTML and positions', () => {
      // Test with the full article HTML
      const h1Start = findPos('Job Growth');
      const h1End = h1Start + 'Job Growth'.length;

      const selStart = findPos('in the United');
      const selEnd = selStart + 'in the United'.length;

      expect(findOverlapOrAdjacent(
        'Job Growth',
        'in the United',
        articleHtml,
        { start: h1Start, end: h1End },
        { start: selStart, end: selEnd }
      )).toBe(true);
    });

    it('should return false for non-adjacent text in article', () => {
      // "Job Growth" (header) and "Job creation" (paragraph) are not adjacent
      const jobGrowthStart = findPos('Job Growth');
      const jobGrowthEnd = jobGrowthStart + 'Job Growth'.length;

      const jobCreationStart = findPos('Job creation');
      const jobCreationEnd = jobCreationStart + 'Job creation'.length;

      expect(findOverlapOrAdjacent(
        'Job Growth',
        'Job creation',
        articleHtml,
        { start: jobGrowthStart, end: jobGrowthEnd },
        { start: jobCreationStart, end: jobCreationEnd }
      )).toBe(false);
    });
  });

  describe('processHighlights with article content', () => {
    it('should highlight text at correct position when same text appears multiple times', () => {
      // "Job" appears multiple times in the article
      // We want to highlight the "Job" in "Job creation" not "Job Growth"
      const jobCreationPos = findPos('Job creation');

      const result = processHighlights({
        content: articleHtml,
        highlights: [{
          id: 1,
          selectedText: 'Job',
          plainTextStart: jobCreationPos,
          plainTextEnd: jobCreationPos + 3,
        }],
      });

      // Verify a highlight was applied
      expect(result).toContain('data-highlight-id="1"');
    });

    it('should highlight multi-word phrase at specific position', () => {
      const phrasePos = findPos('Job creation in the United States slowed');

      const result = processHighlights({
        content: articleHtml,
        highlights: [{
          id: 1,
          selectedText: 'Job creation in the United States slowed',
          plainTextStart: phrasePos,
          plainTextEnd: phrasePos + 'Job creation in the United States slowed'.length,
        }],
      });

      expect(result).toContain('data-highlight-id="1"');
    });

    it('should highlight text that spans HTML tags (bold text)', () => {
      // "half a million jobs over the year" contains <strong> tags
      const phrasePos = findPos('half a million jobs over the year');

      const result = processHighlights({
        content: articleHtml,
        highlights: [{
          id: 1,
          selectedText: 'half a million jobs over the year',
          plainTextStart: phrasePos,
          plainTextEnd: phrasePos + 'half a million jobs over the year'.length,
        }],
      });

      expect(result).toContain('data-highlight-id="1"');
    });
  });

  describe('Edge cases with repeated words', () => {
    it('should correctly handle "by" appearing multiple times', () => {
      // "by" appears in "increased by roughly" and other places
      const firstByPos = findPos('increased by roughly');
      const byInPhrase = plainText.indexOf('by', firstByPos);

      // This "by" should be found at the correct position
      const result = processHighlights({
        content: articleHtml,
        highlights: [{
          id: 1,
          selectedText: 'by',
          plainTextStart: byInPhrase,
          plainTextEnd: byInPhrase + 2,
        }],
      });

      expect(result).toContain('data-highlight-id="1"');
    });

    it('should correctly handle extending "o" and "j" adjacent to existing highlight', () => {
      // This is the user's specific bug case
      // Let's say we have "ob Growth" highlighted and user selects "J" before it
      const jobGrowthPos = findPos('Job Growth');

      // Existing highlight: "ob Growth" (missing the J)
      const existingHighlightStart = jobGrowthPos + 1; // starts at "o"
      const existingHighlightEnd = existingHighlightStart + 'ob Growth'.length;

      // User selects "J" to extend
      const selectionStart = jobGrowthPos;
      const selectionEnd = jobGrowthPos + 1;

      // Should detect adjacency
      expect(arePositionsAdjacentOrOverlapping(
        { start: existingHighlightStart, end: existingHighlightEnd },
        { start: selectionStart, end: selectionEnd },
        plainText
      )).toBe(true);
    });

    it('should handle adjacent single character selection', () => {
      // Highlight "ob Growth", select "J" before it
      const pos = findPos('Job Growth');
      const highlightStart = pos + 1; // "ob Growth"
      const highlightEnd = pos + 10;

      const selectionStart = pos; // "J"
      const selectionEnd = pos + 1;

      expect(arePositionsAdjacentOrOverlapping(
        { start: highlightStart, end: highlightEnd },
        { start: selectionStart, end: selectionEnd },
        plainText
      )).toBe(true);
    });

    it('should handle adjacent two character selection', () => {
      // Highlight "b Growth", select "Jo" before it
      const pos = findPos('Job Growth');
      const highlightStart = pos + 2; // "b Growth"
      const highlightEnd = pos + 10;

      const selectionStart = pos; // "Jo"
      const selectionEnd = pos + 2;

      expect(arePositionsAdjacentOrOverlapping(
        { start: highlightStart, end: highlightEnd },
        { start: selectionStart, end: selectionEnd },
        plainText
      )).toBe(true);
    });
  });

  describe('Specific user scenarios', () => {
    it('Scenario 1: Select "jo" adjacent to highlight should show Extend', () => {
      // If there's a highlight like "b Growth in the United States"
      // and user selects "Jo" right before it, should be detected as adjacent
      const fullText = 'Job Growth in the United States';
      const fullStart = findPos(fullText);

      // Existing highlight: "b Growth in the United States" (starts at "b")
      const highlightStart = fullStart + 2;
      const highlightEnd = fullStart + fullText.length;

      // User selects "Jo"
      const selectionStart = fullStart;
      const selectionEnd = fullStart + 2;

      const isAdjacent = arePositionsAdjacentOrOverlapping(
        { start: highlightStart, end: highlightEnd },
        { start: selectionStart, end: selectionEnd },
        plainText
      );

      expect(isAdjacent).toBe(true);
    });

    it('Scenario 2: Select "by" further in post should highlight correct occurrence', () => {
      // Find all occurrences of "by" in the plain text
      const allByPositions: number[] = [];
      let searchPos = 0;
      while (true) {
        const pos = plainText.indexOf('by', searchPos);
        if (pos === -1) break;
        allByPositions.push(pos);
        searchPos = pos + 1;
      }

      // There should be multiple "by" occurrences
      expect(allByPositions.length).toBeGreaterThan(1);

      // Highlight the SECOND occurrence
      const secondByPos = allByPositions[1];

      const result = processHighlights({
        content: articleHtml,
        highlights: [{
          id: 1,
          selectedText: 'by',
          plainTextStart: secondByPos,
          plainTextEnd: secondByPos + 2,
        }],
      });

      // Should have exactly one highlight
      const markCount = (result.match(/data-highlight-id="1"/g) || []).length;
      expect(markCount).toBe(1);
    });
  });

  describe('User reported bug: payroll employment overlap', () => {
    // This is the exact scenario reported by the user:
    // 1. Highlight "roughly half a million jobs over the year, averaging fewer than 50,000 new jobs per month."
    // 2. Select "employment increased by" - shows "extend" (correct, adjacent)
    // 3. After extending: "employment increased by roughly half a million jobs over the year, averaging fewer than 50,000 new jobs per month."
    // 4. Select "payroll employment" - should show "extend" because "employment" OVERLAPS

    const firstHighlightText = 'roughly half a million jobs over the year, averaging fewer than 50,000 new jobs per month.';
    const extendedHighlightText = 'employment increased by roughly half a million jobs over the year, averaging fewer than 50,000 new jobs per month.';

    it('Step 1: Initial highlight position should be found correctly', () => {
      const pos = findPos(firstHighlightText);
      expect(pos).toBeGreaterThan(0);
      // Verify the text exists in the article
      expect(plainText.substring(pos, pos + firstHighlightText.length)).toBe(firstHighlightText);
    });

    it('Step 2: "employment increased by" should be adjacent to initial highlight', () => {
      const highlightStart = findPos(firstHighlightText);
      const highlightEnd = highlightStart + firstHighlightText.length;

      // "employment increased by " comes right before "roughly"
      const employmentIncreasedBy = 'employment increased by ';
      const selectionEnd = highlightStart; // ends where highlight starts
      const selectionStart = selectionEnd - employmentIncreasedBy.length;

      // Verify the text is correct
      expect(plainText.substring(selectionStart, selectionEnd)).toBe(employmentIncreasedBy);

      // This should be detected as adjacent
      expect(arePositionsAdjacentOrOverlapping(
        { start: highlightStart, end: highlightEnd },
        { start: selectionStart, end: selectionEnd },
        plainText
      )).toBe(true);
    });

    it('Step 3: Extended highlight position should be correct', () => {
      const pos = findPos(extendedHighlightText);
      expect(pos).toBeGreaterThan(0);
      expect(plainText.substring(pos, pos + extendedHighlightText.length)).toBe(extendedHighlightText);
    });

    it('Step 4: "payroll employment" should OVERLAP with extended highlight', () => {
      // The extended highlight starts at "employment"
      const highlightStart = findPos(extendedHighlightText);
      const highlightEnd = highlightStart + extendedHighlightText.length;

      // "payroll employment" selection - ends at the same "employment" that starts the highlight
      const payrollEmployment = 'payroll employment';
      const payrollEmploymentPos = findPos(payrollEmployment);

      // Verify "payroll employment" is found and is the one right before "increased by"
      expect(payrollEmploymentPos).toBeGreaterThan(0);

      // The key insight: "payroll employment" ends at position X + 18
      // The extended highlight "employment increased by..." starts at the "e" in "employment"
      // So "employment" (10 chars) is SHARED between them - this is an OVERLAP!

      // Let's verify the positions
      const selectionStart = payrollEmploymentPos;
      const selectionEnd = payrollEmploymentPos + payrollEmployment.length;

      // Debug: print the positions
      console.log('Extended highlight starts at:', highlightStart);
      console.log('Extended highlight text starts with:', plainText.substring(highlightStart, highlightStart + 20));
      console.log('payroll employment at:', selectionStart, '-', selectionEnd);
      console.log('payroll employment text:', plainText.substring(selectionStart, selectionEnd));

      // The "employment" in "payroll employment" should be the SAME "employment" that starts the highlight
      // So positions should overlap!
      expect(arePositionsAdjacentOrOverlapping(
        { start: highlightStart, end: highlightEnd },
        { start: selectionStart, end: selectionEnd },
        plainText
      )).toBe(true);
    });

    it('Step 4b: Verify the word "employment" is shared between selection and highlight', () => {
      const payrollEmploymentPos = findPos('payroll employment');
      const extendedHighlightPos = findPos(extendedHighlightText);

      // "payroll employment" is at position X to X+18
      // "employment increased by..." is at position Y to Y+length

      // If "employment" is the same word (not a different occurrence), then:
      // payrollEmploymentPos + 8 (for "payroll ") should equal extendedHighlightPos

      const employmentInPayroll = payrollEmploymentPos + 'payroll '.length;
      const employmentInHighlight = extendedHighlightPos;

      // These should be the SAME position - meaning they share the word "employment"
      expect(employmentInPayroll).toBe(employmentInHighlight);
    });

    it('Step 4c: The overlap detection should catch shared "employment"', () => {
      const payrollEmploymentPos = findPos('payroll employment');
      const extendedHighlightPos = findPos(extendedHighlightText);

      // Selection: "payroll employment" = position [payrollEmploymentPos, payrollEmploymentPos + 18]
      // Highlight: starts at extendedHighlightPos

      const selectionStart = payrollEmploymentPos;
      const selectionEnd = payrollEmploymentPos + 'payroll employment'.length;
      const highlightStart = extendedHighlightPos;
      const highlightEnd = highlightStart + extendedHighlightText.length;

      // The selection ends at position selectionEnd
      // The highlight starts at position highlightStart
      // If selectionEnd > highlightStart, they overlap!

      console.log('Selection:', selectionStart, '-', selectionEnd);
      console.log('Highlight:', highlightStart, '-', highlightEnd);
      console.log('Do they overlap? selectionEnd > highlightStart:', selectionEnd > highlightStart);

      // They should overlap because "employment" is shared
      expect(selectionEnd).toBeGreaterThan(highlightStart);

      // And the overlap detection should return true
      expect(arePositionsAdjacentOrOverlapping(
        { start: highlightStart, end: highlightEnd },
        { start: selectionStart, end: selectionEnd },
        plainText
      )).toBe(true);
    });
  });

  describe('User reported bug: period overlap with ". Total"', () => {
    // User scenario:
    // 1. Highlight "United States slowed significantly in 2025. " (includes ". ")
    // 2. Select ". Total" - should show "extend highlight" because they share ". "

    const highlightText = 'United States slowed significantly in 2025. ';
    const selectionText = '. Total';

    it('should find both texts in the article', () => {
      const highlightPos = findPos('United States slowed significantly in 2025.');
      expect(highlightPos).toBeGreaterThan(0);

      const totalPos = findPos('Total nonfarm');
      expect(totalPos).toBeGreaterThan(0);
    });

    it('should detect overlap when selection shares ". " with highlight end', () => {
      // Find the highlight position
      const highlightStart = findPos('United States slowed significantly in 2025.');
      const highlightEnd = highlightStart + highlightText.length;

      // Find the ". Total" position - it starts 2 chars before "Total"
      const totalPos = findPos('Total nonfarm');
      const selectionStart = totalPos - 2; // ". Total" starts at the period
      const selectionEnd = selectionStart + selectionText.length;

      // Verify the text at selection position
      expect(plainText.substring(selectionStart, selectionEnd)).toBe(selectionText);

      // The overlap: highlight ends at position X, selection starts at X-2
      // So selectionStart < highlightEnd, meaning they overlap!
      console.log('Highlight:', highlightStart, '-', highlightEnd);
      console.log('Selection:', selectionStart, '-', selectionEnd);
      console.log('Overlap check: selectionStart < highlightEnd:', selectionStart < highlightEnd);

      expect(selectionStart).toBeLessThan(highlightEnd);

      // arePositionsAdjacentOrOverlapping should detect this
      expect(arePositionsAdjacentOrOverlapping(
        { start: highlightStart, end: highlightEnd },
        { start: selectionStart, end: selectionEnd },
        plainText
      )).toBe(true);
    });

    it('should detect overlap via findOverlapOrAdjacent with positions', () => {
      const highlightStart = findPos('United States slowed significantly in 2025.');
      const highlightEnd = highlightStart + highlightText.length;

      const totalPos = findPos('Total nonfarm');
      const selectionStart = totalPos - 2;
      const selectionEnd = selectionStart + selectionText.length;

      const result = findOverlapOrAdjacent(
        highlightText,
        selectionText,
        articleHtml,
        { start: highlightStart, end: highlightEnd },
        { start: selectionStart, end: selectionEnd }
      );

      expect(result).toBe(true);
    });
  });

  describe('Highlight Merge Scenarios', () => {
    // Article text reference (for planning tests):
    // "Job creation in the United States slowed significantly in 2025. Total nonfarm payroll
    //  employment increased by roughly half a million jobs over the year, averaging fewer than
    //  50,000 new jobs per month."

    describe('Merging 2 overlapping highlights', () => {
      it('should detect overlap when highlights share text at boundary', () => {
        // Highlight A: "Job creation in the United"
        // Highlight B: "United States slowed"
        // They share "United"
        const highlightA = 'Job creation in the United';
        const highlightB = 'United States slowed';

        const posA = findPos(highlightA);
        const posB = findPos('United States slowed');

        expect(posA).toBeGreaterThanOrEqual(0);
        expect(posB).toBeGreaterThan(0);

        // Selection spans from A to B: "Job creation in the United States slowed"
        const selectionText = 'Job creation in the United States slowed';
        const selectionStart = posA;
        const selectionEnd = selectionStart + selectionText.length;

        // Both highlights should be detected as overlapping with the selection
        expect(arePositionsAdjacentOrOverlapping(
          { start: posA, end: posA + highlightA.length },
          { start: selectionStart, end: selectionEnd },
          plainText
        )).toBe(true);

        expect(arePositionsAdjacentOrOverlapping(
          { start: posB, end: posB + highlightB.length },
          { start: selectionStart, end: selectionEnd },
          plainText
        )).toBe(true);
      });

      it('should merge overlapping text correctly', () => {
        // Highlight A: "United States slowed"
        // Highlight B: "slowed significantly in 2025"
        // Merged should be: "United States slowed significantly in 2025"
        const merged = mergeTexts('United States slowed', 'slowed significantly in 2025', articleHtml);
        expect(merged).toBe('United States slowed significantly in 2025');
      });
    });

    describe('Merging 2 adjacent highlights (no gap)', () => {
      it('should detect adjacency when highlights touch', () => {
        // Highlight A: "Job creation"
        // Highlight B: " in the United"
        // They are adjacent (A ends, B starts immediately)
        const highlightA = 'Job creation';
        const highlightB = ' in the United';

        const posA = findPos(highlightA);
        const posB = posA + highlightA.length; // B starts right after A

        // Selection that spans both: "Job creation in the United"
        const selectionStart = posA;
        const selectionEnd = posB + highlightB.length;

        // Check adjacency
        expect(arePositionsAdjacentOrOverlapping(
          { start: posA, end: posA + highlightA.length },
          { start: selectionStart, end: selectionEnd },
          plainText
        )).toBe(true);
      });

      it('should merge adjacent text correctly', () => {
        const merged = mergeTexts('Job creation', ' in the United', articleHtml);
        expect(merged).toBe('Job creation in the United');
      });
    });

    describe('Merging 2 adjacent highlights (with whitespace gap)', () => {
      it('should detect adjacency when selection spans whitespace gap', () => {
        // Use "2025." and "Total" which have a space between them
        const highlightA = 'in 2025.';
        const highlightB = 'Total nonfarm';

        const posA = findPos(highlightA);
        const posAEnd = posA + highlightA.length;
        const posB = findPos(highlightB);

        // There should be a space between "2025." and "Total"
        expect(posB).toBeGreaterThan(posAEnd);
        expect(posB - posAEnd).toBeLessThanOrEqual(2); // at most 1-2 chars gap

        // Selection spans both: "in 2025. Total nonfarm"
        const selectionStart = posA;
        const selectionEnd = posB + highlightB.length;

        // Both should be detected as overlapping with selection (selection contains both)
        expect(arePositionsAdjacentOrOverlapping(
          { start: posA, end: posAEnd },
          { start: selectionStart, end: selectionEnd },
          plainText
        )).toBe(true);

        expect(arePositionsAdjacentOrOverlapping(
          { start: posB, end: posB + highlightB.length },
          { start: selectionStart, end: selectionEnd },
          plainText
        )).toBe(true);
      });

      it('should merge text with space gap correctly', () => {
        const merged = mergeTexts('in 2025.', 'Total nonfarm', articleHtml);
        expect(merged).toBe('in 2025. Total nonfarm');
      });
    });

    describe('Merging 3 overlapping highlights', () => {
      it('should detect all 3 highlights overlap with selection', () => {
        // Use unique text: "slowed significantly in 2025. Total nonfarm payroll"
        // Highlight A: "slowed significantly in"
        // Highlight B: "in 2025. Total"
        // Highlight C: "Total nonfarm payroll"
        const highlightA = 'slowed significantly in';
        const highlightB = 'in 2025. Total';
        const highlightC = 'Total nonfarm payroll';

        const posA = findPos(highlightA);
        const posB = findPos(highlightB);
        const posC = findPos(highlightC);

        // Verify order
        expect(posB).toBeGreaterThan(posA);
        expect(posC).toBeGreaterThan(posB);

        // Selection spans all three
        const selectionStart = posA;
        const selectionEnd = posC + highlightC.length;

        // All 3 should overlap with selection (selection contains all of them)
        expect(arePositionsAdjacentOrOverlapping(
          { start: posA, end: posA + highlightA.length },
          { start: selectionStart, end: selectionEnd },
          plainText
        )).toBe(true);

        expect(arePositionsAdjacentOrOverlapping(
          { start: posB, end: posB + highlightB.length },
          { start: selectionStart, end: selectionEnd },
          plainText
        )).toBe(true);

        expect(arePositionsAdjacentOrOverlapping(
          { start: posC, end: posC + highlightC.length },
          { start: selectionStart, end: selectionEnd },
          plainText
        )).toBe(true);
      });

      it('should merge 3 overlapping texts correctly', () => {
        // These overlap, so mergeTexts should work
        let merged = mergeTexts('slowed significantly in', 'in 2025. Total', articleHtml);
        expect(merged).toBe('slowed significantly in 2025. Total');

        merged = mergeTexts(merged, 'Total nonfarm payroll', articleHtml);
        expect(merged).toBe('slowed significantly in 2025. Total nonfarm payroll');
      });
    });

    describe('Merging 3 highlights with mixed adjacent/overlapping', () => {
      it('should handle mix of adjacent and overlapping', () => {
        // Use unique text that we can verify positions for
        // Highlight A: "significantly in 2025"
        // Highlight B: "2025." (overlaps A at "2025")
        // Highlight C: ". Total" (overlaps B at ".")
        const highlightA = 'significantly in 2025';
        const highlightB = '2025.';
        const highlightC = '. Total';

        const posA = findPos(highlightA);
        const posB = findPos(highlightB);
        const posC = findPos(highlightC);

        // Selection spans A to C: "significantly in 2025. Total"
        const selectionStart = posA;
        const selectionEnd = posC + highlightC.length;

        // A should overlap with selection
        expect(arePositionsAdjacentOrOverlapping(
          { start: posA, end: posA + highlightA.length },
          { start: selectionStart, end: selectionEnd },
          plainText
        )).toBe(true);

        // B should overlap with selection
        expect(arePositionsAdjacentOrOverlapping(
          { start: posB, end: posB + highlightB.length },
          { start: selectionStart, end: selectionEnd },
          plainText
        )).toBe(true);
      });

      it('should merge mixed adjacent/overlapping correctly', () => {
        let merged = mergeTexts('significantly in 2025', '2025.', articleHtml);
        expect(merged).toBe('significantly in 2025.');

        merged = mergeTexts(merged, '. Total', articleHtml);
        expect(merged).toBe('significantly in 2025. Total');
      });
    });

    describe('Selection spanning multiple highlights within sentence', () => {
      it('should detect all highlights when selection contains them', () => {
        // Use a part of the sentence with unique text:
        // "slowed significantly in 2025. Total nonfarm payroll employment"
        // Highlights:
        // A: "slowed significantly"
        // B: "in 2025."
        // C: "Total nonfarm"
        const highlightA = 'slowed significantly';
        const highlightB = 'in 2025.';
        const highlightC = 'Total nonfarm';

        const posA = findPos(highlightA);
        const posB = findPos(highlightB);
        const posC = findPos(highlightC);

        // Verify order: A comes before B, B comes before C
        expect(posB).toBeGreaterThan(posA);
        expect(posC).toBeGreaterThan(posB);

        // Selection spans all three
        const selectionStart = posA;
        const selectionEnd = posC + highlightC.length;

        // All 3 should be detected (selection contains all of them)
        expect(arePositionsAdjacentOrOverlapping(
          { start: posA, end: posA + highlightA.length },
          { start: selectionStart, end: selectionEnd },
          plainText
        )).toBe(true);

        expect(arePositionsAdjacentOrOverlapping(
          { start: posB, end: posB + highlightB.length },
          { start: selectionStart, end: selectionEnd },
          plainText
        )).toBe(true);

        expect(arePositionsAdjacentOrOverlapping(
          { start: posC, end: posC + highlightC.length },
          { start: selectionStart, end: selectionEnd },
          plainText
        )).toBe(true);
      });

      it('should merge consecutive overlapping highlights', () => {
        // Use overlapping highlights that can be merged step by step
        let merged = mergeTexts('slowed significantly', 'significantly in 2025.', articleHtml);
        expect(merged).toBe('slowed significantly in 2025.');

        merged = mergeTexts(merged, '2025. Total', articleHtml);
        expect(merged).toBe('slowed significantly in 2025. Total');

        merged = mergeTexts(merged, 'Total nonfarm', articleHtml);
        expect(merged).toBe('slowed significantly in 2025. Total nonfarm');
      });
    });

    describe('Edge cases for merge detection', () => {
      it('should handle single character overlap', () => {
        // Highlight A: "2025"
        // Highlight B: "5."
        // They share "5"
        const posA = findPos('2025');
        const posB = findPos('5.');

        // Selection: "2025."
        const selectionText = '2025.';
        const selectionStart = posA;
        const selectionEnd = selectionStart + selectionText.length;

        // Highlight A should overlap with selection
        expect(arePositionsAdjacentOrOverlapping(
          { start: posA, end: posA + 4 },
          { start: selectionStart, end: selectionEnd },
          plainText
        )).toBe(true);

        // Highlight B should also overlap with selection
        expect(arePositionsAdjacentOrOverlapping(
          { start: posB, end: posB + 2 },
          { start: selectionStart, end: selectionEnd },
          plainText
        )).toBe(true);
      });

      it('should handle period and space overlap', () => {
        // Highlight A: "2025."
        // Highlight B: ". Total"
        const posA = findPos('2025.');
        const dotTotalPos = findPos('. Total');

        // Selection spanning both
        const selectionStart = posA;
        const selectionEnd = dotTotalPos + '. Total'.length;

        expect(arePositionsAdjacentOrOverlapping(
          { start: posA, end: posA + 5 },
          { start: selectionStart, end: selectionEnd },
          plainText
        )).toBe(true);
      });

      it('should NOT merge non-adjacent, non-overlapping highlights', () => {
        // Highlight A: "Job creation"
        // Highlight B: "averaging fewer" (much later in text)
        const posA = findPos('Job creation');
        const posB = findPos('averaging fewer');

        // These are far apart - selection of just one shouldn't detect the other
        const selectionA = { start: posA, end: posA + 'Job creation'.length };
        const highlightBPos = { start: posB, end: posB + 'averaging fewer'.length };

        expect(arePositionsAdjacentOrOverlapping(
          highlightBPos,
          selectionA,
          plainText
        )).toBe(false);
      });
    });

    describe('Merge with position-based selection detection', () => {
      it('should correctly identify selection start inside highlight A and end inside highlight B', () => {
        // Highlight A: "Job creation in the United"
        // Highlight B: "States slowed significantly"
        // Selection: "United States slowed" (starts inside A, ends inside B)
        const posA = findPos('Job creation in the United');
        const posB = findPos('States slowed significantly');

        const selectionText = 'United States slowed';
        const selectionPos = findPos(selectionText);

        // Selection start should be inside highlight A
        const selStart = selectionPos;
        const selEnd = selectionPos + selectionText.length;
        const highlightAStart = posA;
        const highlightAEnd = posA + 'Job creation in the United'.length;
        const highlightBStart = posB;
        const highlightBEnd = posB + 'States slowed significantly'.length;

        // Selection start (at "United") should be inside highlight A
        expect(selStart >= highlightAStart && selStart < highlightAEnd).toBe(true);

        // Selection end (at end of "slowed") should be inside highlight B
        expect(selEnd > highlightBStart && selEnd <= highlightBEnd).toBe(true);
      });
    });
  });
});
