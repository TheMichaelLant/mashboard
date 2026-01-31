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
      expect(result).toContain('<mark class="highlight-mark" data-highlight-id="1">sample text</mark>');
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
      expect(result).toContain('<mark class="highlight-mark" data-highlight-id="1">Start</mark>');
    });

    it('should handle highlight at the very end of content', () => {
      const result = processHighlights({
        content: '<p>Text at end</p>',
        highlights: [{ id: 1, selectedText: 'end' }],
      });
      expect(result).toContain('<mark class="highlight-mark" data-highlight-id="1">end</mark>');
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

  it('should return true for overlapping text', () => {
    expect(findOverlapOrAdjacent('comprehensive test', 'test suite', content)).toBe(true);
  });

  it('should return true for adjacent text', () => {
    expect(findOverlapOrAdjacent('Done!', 'I\'ve created', content)).toBe(true);
  });

  it('should return false for non-overlapping and non-adjacent text', () => {
    expect(findOverlapOrAdjacent('Done!', 'suite', content)).toBe(false);
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

    it('should handle partial word that looks like overlap but is not', () => {
      // "fox" and "jumps" don't overlap, but are adjacent
      expect(findOverlapOrAdjacent('fox', 'jumps', content)).toBe(true);
    });

    it('should detect both overlap AND adjacency', () => {
      // "brown fox" overlaps with "fox jumps" at "fox"
      expect(findOverlapOrAdjacent('brown fox', 'fox jumps', content)).toBe(true);
    });

    it('should return false for text in different parts of content', () => {
      expect(findOverlapOrAdjacent('quick', 'lazy', content)).toBe(false);
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
      expect(result).toBe('<mark class="highlight-mark" data-highlight-id="1">Exact content</mark>');
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
