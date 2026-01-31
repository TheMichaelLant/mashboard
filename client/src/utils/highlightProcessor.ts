/**
 * Highlight processor utility
 * Processes HTML content and wraps highlighted text with mark elements
 */

export interface HighlightInput {
  id: number;
  selectedText: string;
}

export interface ProcessHighlightsOptions {
  content: string;
  highlights: HighlightInput[];
}

/**
 * Normalizes whitespace in a string by collapsing multiple whitespace chars to single space
 */
export function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Creates a regex pattern that matches the text with flexible whitespace
 */
export function createFlexiblePattern(text: string): RegExp {
  // Escape regex special chars and replace whitespace with \s+
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flexible = escaped.replace(/\s+/g, '\\s+');
  return new RegExp(flexible);
}

/**
 * Escapes special regex characters in a string
 */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks if two strings overlap (share characters at edges or one contains the other)
 */
export function findOverlap(str1: string, str2: string): boolean {
  // Check if one contains the other
  if (str1.includes(str2) || str2.includes(str1)) return true;

  // Check if str1's end overlaps with str2's beginning
  for (let i = 1; i < str1.length; i++) {
    if (str2.startsWith(str1.slice(i))) return true;
  }

  // Check if str2's end overlaps with str1's beginning
  for (let i = 1; i < str2.length; i++) {
    if (str1.startsWith(str2.slice(i))) return true;
  }

  return false;
}

/**
 * Checks if two strings are adjacent in the content (with optional whitespace between)
 * Returns 'before' if highlightText comes before selectedText,
 * 'after' if highlightText comes after selectedText,
 * or null if not adjacent
 */
export function findAdjacent(
  highlightText: string,
  selectedText: string,
  content: string
): 'before' | 'after' | null {
  if (!content) return null;

  // Strip HTML tags for plain text comparison
  const plainContent = content.replace(/<[^>]*>/g, '');

  // Check if highlight comes immediately before selection (with optional whitespace)
  const beforePattern = new RegExp(
    escapeRegex(highlightText) + '\\s*' + escapeRegex(selectedText)
  );
  if (beforePattern.test(plainContent)) return 'before';

  // Check if highlight comes immediately after selection (with optional whitespace)
  const afterPattern = new RegExp(
    escapeRegex(selectedText) + '\\s*' + escapeRegex(highlightText)
  );
  if (afterPattern.test(plainContent)) return 'after';

  return null;
}

/**
 * Checks if two strings either overlap or are adjacent in the content
 */
export function findOverlapOrAdjacent(
  highlightText: string,
  selectedText: string,
  content: string
): boolean {
  return findOverlap(highlightText, selectedText) || findAdjacent(highlightText, selectedText, content) !== null;
}

/**
 * Merges two overlapping or adjacent text strings based on their position in content
 */
export function mergeTexts(
  existing: string,
  newText: string,
  content: string
): string {
  // If one contains the other entirely, return the longer one
  if (existing.includes(newText)) return existing;
  if (newText.includes(existing)) return newText;

  // Find overlap where existing ends and newText begins
  for (let i = 1; i < existing.length; i++) {
    const suffix = existing.slice(i);
    if (newText.startsWith(suffix)) {
      return existing + newText.slice(suffix.length);
    }
  }

  // Find overlap where newText ends and existing begins
  for (let i = 1; i < newText.length; i++) {
    const suffix = newText.slice(i);
    if (existing.startsWith(suffix)) {
      return newText + existing.slice(suffix.length);
    }
  }

  // No overlap found - check for adjacency
  const adjacency = findAdjacent(existing, newText, content);
  if (adjacency === 'before') {
    // existing comes before newText - find the combined text in content
    const plainContent = content.replace(/<[^>]*>/g, '');
    const pattern = new RegExp(
      escapeRegex(existing) + '(\\s*)' + escapeRegex(newText)
    );
    const match = plainContent.match(pattern);
    if (match) {
      return existing + (match[1] || '') + newText;
    }
  } else if (adjacency === 'after') {
    // existing comes after newText
    const plainContent = content.replace(/<[^>]*>/g, '');
    const pattern = new RegExp(
      escapeRegex(newText) + '(\\s*)' + escapeRegex(existing)
    );
    const match = plainContent.match(pattern);
    if (match) {
      return newText + (match[1] || '') + existing;
    }
  }

  // Fallback - shouldn't happen
  return newText;
}

/**
 * Maps a position in plain text to the corresponding position in HTML content
 */
export function mapPlainToHtmlPosition(
  htmlContent: string,
  plainPosition: number,
  plainLength: number
): { startHtmlIndex: number; endHtmlIndex: number } {
  let charCount = 0;
  let htmlIndex = 0;
  let startHtmlIndex = -1;
  let endHtmlIndex = -1;

  while (htmlIndex < htmlContent.length && endHtmlIndex === -1) {
    // Skip HTML tags
    if (htmlContent[htmlIndex] === '<') {
      const tagEnd = htmlContent.indexOf('>', htmlIndex);
      if (tagEnd !== -1) {
        htmlIndex = tagEnd + 1;
        continue;
      }
    }

    // Mark start position
    if (charCount === plainPosition && startHtmlIndex === -1) {
      startHtmlIndex = htmlIndex;
    }

    charCount++;

    // Mark end position
    if (charCount === plainPosition + plainLength) {
      endHtmlIndex = htmlIndex + 1;
      break;
    }

    htmlIndex++;
  }

  return { startHtmlIndex, endHtmlIndex };
}

/**
 * Wraps text that may contain HTML tags with mark elements
 * Adds data-highlight-pos attribute for proper border-radius styling:
 * - "only": single segment (both first and last)
 * - "first": first segment of multi-part highlight
 * - "last": last segment of multi-part highlight
 * - no attribute: middle segment (no border-radius)
 */
export function wrapWithMark(text: string, highlightId: number): string {
  if (text.includes('<')) {
    // Split by HTML tags, wrap text parts, rejoin
    const parts = text.split(/(<[^>]*>)/);

    // Find indices of text parts (non-tags, non-empty)
    const textPartIndices: number[] = [];
    parts.forEach((part, i) => {
      if (!part.startsWith('<') && part.trim()) {
        textPartIndices.push(i);
      }
    });

    // If only one text part, it's the only segment
    if (textPartIndices.length === 1) {
      return parts.map((part, i) => {
        if (i === textPartIndices[0]) {
          return `<mark class="highlight-mark" data-highlight-id="${highlightId}" data-highlight-pos="only">${part}</mark>`;
        }
        return part;
      }).join('');
    }

    // Multiple text parts - add position attributes
    const firstIdx = textPartIndices[0];
    const lastIdx = textPartIndices[textPartIndices.length - 1];

    return parts.map((part, i) => {
      if (part.startsWith('<') || !part.trim()) {
        return part; // Keep tags and whitespace-only parts as-is
      }

      let posAttr = '';
      if (i === firstIdx) {
        posAttr = ' data-highlight-pos="first"';
      } else if (i === lastIdx) {
        posAttr = ' data-highlight-pos="last"';
      }
      // Middle parts get no position attribute (no border-radius)

      return `<mark class="highlight-mark" data-highlight-id="${highlightId}"${posAttr}>${part}</mark>`;
    }).join('');
  }
  // Single text without HTML tags - it's the only segment
  return `<mark class="highlight-mark" data-highlight-id="${highlightId}" data-highlight-pos="only">${text}</mark>`;
}

/**
 * Processes content and applies highlight marks
 *
 * @param options - The content and highlights to process
 * @returns The processed content with highlight marks
 */
export function processHighlights({ content, highlights }: ProcessHighlightsOptions): string {
  if (!content || highlights.length === 0) {
    return content;
  }

  let result = content;

  // Sort highlights by length (longest first) to avoid partial replacements
  const sortedHighlights = [...highlights].sort(
    (a, b) => b.selectedText.length - a.selectedText.length
  );

  // Track highlighted texts to avoid duplicates and nested highlights
  const highlightedTexts: string[] = [];

  // Helper to check if text is contained within already-highlighted text
  const isContainedInHighlighted = (normalizedText: string): boolean => {
    return highlightedTexts.some(
      highlighted => highlighted.includes(normalizedText) || normalizedText === highlighted
    );
  };

  for (const highlight of sortedHighlights) {
    const text = highlight.selectedText;
    const highlightId = highlight.id;
    const normalizedText = normalizeWhitespace(text);

    // Skip empty or whitespace-only highlights
    if (!normalizedText) continue;

    // Skip if this text is already highlighted or contained within a longer highlight
    if (isContainedInHighlighted(normalizedText)) continue;

    // Method 1: Try direct replacement (exact match in content, no HTML tags involved)
    if (result.includes(text)) {
      const replacement = `<mark class="highlight-mark" data-highlight-id="${highlightId}">${text}</mark>`;
      result = result.replace(text, replacement);
      highlightedTexts.push(normalizedText);
      continue;
    }

    // Method 2: Try matching in plain text (handles text spanning HTML tags)
    try {
      // Strip HTML tags to get plain text for searching
      const plainContent = result.replace(/<[^>]*>/g, '');

      // Try exact match in plain text first
      let plainIndex = plainContent.indexOf(text);
      let matchLength = text.length;

      // If no exact match, try flexible whitespace match
      if (plainIndex === -1) {
        const flexPattern = createFlexiblePattern(text);
        const flexMatch = plainContent.match(flexPattern);
        if (flexMatch && flexMatch.index !== undefined) {
          plainIndex = flexMatch.index;
          matchLength = flexMatch[0].length;
        }
      }

      if (plainIndex !== -1) {
        const { startHtmlIndex, endHtmlIndex } = mapPlainToHtmlPosition(result, plainIndex, matchLength);

        if (startHtmlIndex !== -1 && endHtmlIndex !== -1) {
          const matchedText = result.slice(startHtmlIndex, endHtmlIndex);
          const matchedPlain = matchedText.replace(/<[^>]*>/g, '');

          // Verify the match by comparing normalized text
          if (normalizeWhitespace(matchedPlain) === normalizedText) {
            const replacement = wrapWithMark(matchedText, highlightId);
            result = result.slice(0, startHtmlIndex) + replacement + result.slice(endHtmlIndex);
            highlightedTexts.push(normalizedText);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to process highlight:', text, e);
    }
  }

  return result;
}
