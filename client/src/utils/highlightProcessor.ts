/**
 * Highlight processor utility
 * Processes HTML content and wraps highlighted text with mark elements
 */

export interface HighlightInput {
  id: number;
  selectedText: string;
  /** Character offset in plain text content where highlight starts (optional for backward compat) */
  plainTextStart?: number;
  /** Character offset in plain text content where highlight ends (optional for backward compat) */
  plainTextEnd?: number;
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
 * Block-level HTML tags that should have whitespace between them
 */
const BLOCK_TAGS = new Set([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'hr', 'br',
  'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot',
  'article', 'section', 'header', 'footer', 'nav', 'aside',
  'figure', 'figcaption', 'main', 'address', 'dd', 'dl', 'dt',
]);

/**
 * Adds whitespace between adjacent block elements in HTML
 * This ensures text selections that span blocks (like h3 → p) can be matched
 * since browsers include a space in selections at block boundaries
 */
export function addSpacesBetweenBlocks(html: string): string {
  // Add space after closing block tags if followed by another tag without space
  return html.replace(/<\/([\w]+)>(\s*)<([\w]+)/g, (match, closeTag, whitespace, openTag) => {
    const closeIsBlock = BLOCK_TAGS.has(closeTag.toLowerCase());
    const openIsBlock = BLOCK_TAGS.has(openTag.toLowerCase());

    // If either tag is a block element and there's no whitespace, add a space
    if ((closeIsBlock || openIsBlock) && !whitespace) {
      return `</${closeTag}> <${openTag}`;
    }
    return match;
  });
}

/**
 * Strips HTML tags and adds whitespace between block elements
 * This ensures text selections that span blocks (like h3 → p) can be matched
 */
export function stripHtmlWithSpaces(html: string): string {
  // First add spaces between block elements, then strip all tags
  return addSpacesBetweenBlocks(html).replace(/<[^>]*>/g, '');
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

  // Strip HTML tags for plain text comparison (with spaces between block elements)
  const plainContent = stripHtmlWithSpaces(content);

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
 * Checks if two texts actually overlap at the same location in the content
 * This prevents false positives where texts overlap textually but are in different parts of the document
 *
 * Handles both:
 * - Edge overlaps: where one text's end matches another's beginning
 * - Containment: where one text contains another (needed for split highlight)
 *
 * For containment, we verify that both texts exist at the SAME location in content
 * to avoid false positives where the contained text appears elsewhere in the document.
 */
export function findOverlapInContent(
  highlightText: string,
  selectedText: string,
  content: string
): boolean {
  if (!content) return false;

  const plainContent = stripHtmlWithSpaces(content);

  // Check for containment with position verification
  // This is needed for split highlight functionality
  // IMPORTANT: Only match containment if ALL occurrences of the selected text
  // are within the highlight's range. If the selected text appears elsewhere
  // in the content, we can't reliably know which occurrence the user selected.
  if (highlightText.includes(selectedText) && highlightText !== selectedText) {
    // Find where the highlight exists in content
    const highlightPos = plainContent.indexOf(highlightText);
    if (highlightPos !== -1) {
      const highlightEnd = highlightPos + highlightText.length;

      // Check if ALL occurrences of selectedText are within the highlight's range
      let allWithinHighlight = true;
      let hasOccurrenceInHighlight = false;
      let searchPos = 0;

      while (searchPos < plainContent.length) {
        const occurrencePos = plainContent.indexOf(selectedText, searchPos);
        if (occurrencePos === -1) break;

        const occurrenceEnd = occurrencePos + selectedText.length;
        if (occurrencePos >= highlightPos && occurrenceEnd <= highlightEnd) {
          // This occurrence is within the highlight
          hasOccurrenceInHighlight = true;
        } else {
          // This occurrence is outside the highlight
          allWithinHighlight = false;
        }
        searchPos = occurrencePos + 1;
      }

      // Only match if there's at least one occurrence in the highlight
      // AND all occurrences are within the highlight (no ambiguity)
      if (hasOccurrenceInHighlight && allWithinHighlight) {
        return true;
      }
    }
  }

  if (selectedText.includes(highlightText) && selectedText !== highlightText) {
    // Find where the selection would exist in content
    const selectedPos = plainContent.indexOf(selectedText);
    if (selectedPos !== -1) {
      const selectedEnd = selectedPos + selectedText.length;

      // Check if ALL occurrences of highlightText are within the selection's range
      let allWithinSelection = true;
      let hasOccurrenceInSelection = false;
      let searchPos = 0;

      while (searchPos < plainContent.length) {
        const occurrencePos = plainContent.indexOf(highlightText, searchPos);
        if (occurrencePos === -1) break;

        const occurrenceEnd = occurrencePos + highlightText.length;
        if (occurrencePos >= selectedPos && occurrenceEnd <= selectedEnd) {
          // This occurrence is within the selection
          hasOccurrenceInSelection = true;
        } else {
          // This occurrence is outside the selection
          allWithinSelection = false;
        }
        searchPos = occurrencePos + 1;
      }

      // Only match if there's at least one occurrence in the selection
      // AND all occurrences are within the selection (no ambiguity)
      if (hasOccurrenceInSelection && allWithinSelection) {
        return true;
      }
    }
  }

  // Handle exact match case - identical texts always overlap
  if (highlightText === selectedText) {
    return plainContent.includes(highlightText);
  }

  // Check for edge overlaps where texts meet/overlap at boundaries
  // Require minimum 2-character overlap to avoid false positives

  // Pattern 1: Check for edge overlaps where highlightText end overlaps selectedText start
  // e.g., highlight="...incr" and selection="increased" -> overlap at "incr"
  for (let i = 1; i < highlightText.length; i++) {
    const highlightSuffix = highlightText.slice(i);
    // Require at least 2 characters overlap to avoid single-char false positives
    if (highlightSuffix.length < 2) continue;
    if (selectedText.startsWith(highlightSuffix)) {
      // Check if this overlap actually exists in content
      // Combined text: highlightText + remainder of selection (without the overlap)
      const remainingSelected = selectedText.slice(highlightSuffix.length);
      if (remainingSelected.length > 0) {
        // The combined text should exist in content
        // e.g., "...incr" + "eased" should form "...increased" which exists in content
        const combinedText = highlightText + remainingSelected;
        if (plainContent.includes(combinedText)) {
          return true;
        }
        // Also try with flexible whitespace for block boundaries
        const flexPattern = new RegExp(escapeRegex(highlightText) + '\\s*' + escapeRegex(remainingSelected.trim()));
        if (flexPattern.test(plainContent)) {
          return true;
        }
      } else {
        // Selection is fully a suffix of highlight - verify highlight exists in content
        if (plainContent.includes(highlightText)) {
          return true;
        }
      }
    }
  }

  // Pattern 2: Check for edge overlaps the other direction
  // e.g., highlight="eased by..." and selection="increased" -> overlap at "eased"
  for (let i = 1; i < selectedText.length; i++) {
    const selectedSuffix = selectedText.slice(i);
    // Require at least 2 characters overlap to avoid single-char false positives
    if (selectedSuffix.length < 2) continue;
    if (highlightText.startsWith(selectedSuffix)) {
      // Combined text: selection + remainder of highlight (without the overlap)
      const remainingHighlight = highlightText.slice(selectedSuffix.length);
      if (remainingHighlight.length > 0) {
        // The combined text should exist in content
        // e.g., "increased" + " by roughly" forms "increased by roughly"
        const combinedText = selectedText + remainingHighlight;
        if (plainContent.includes(combinedText)) {
          return true;
        }
        // Also try with flexible whitespace for block boundaries
        const flexPattern = new RegExp(escapeRegex(selectedText) + '\\s*' + escapeRegex(remainingHighlight.trim()));
        if (flexPattern.test(plainContent)) {
          return true;
        }
      } else {
        // Highlight is fully a suffix of selection - verify selection exists in content
        if (plainContent.includes(selectedText)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Position info for overlap/adjacency detection
 */
export interface SelectionPosition {
  /** Start position in plain text */
  start: number;
  /** End position in plain text */
  end: number;
}

/**
 * Checks if two positions are adjacent or overlapping
 * Adjacent means they touch (one ends where the other begins, with optional whitespace)
 * Overlapping means they share character positions
 */
export function arePositionsAdjacentOrOverlapping(
  highlightPos: SelectionPosition,
  selectionPos: SelectionPosition,
  plainContent: string
): boolean {
  // Check for overlap (ranges intersect)
  const overlap = !(selectionPos.end <= highlightPos.start || selectionPos.start >= highlightPos.end);
  if (overlap) return true;

  // Check for adjacency (with possible whitespace between)
  // Selection immediately after highlight
  if (selectionPos.start >= highlightPos.end) {
    const gap = plainContent.slice(highlightPos.end, selectionPos.start);
    if (gap.length === 0 || /^\s*$/.test(gap)) return true;
  }

  // Selection immediately before highlight
  if (selectionPos.end <= highlightPos.start) {
    const gap = plainContent.slice(selectionPos.end, highlightPos.start);
    if (gap.length === 0 || /^\s*$/.test(gap)) return true;
  }

  return false;
}

/**
 * Checks if two strings either overlap or are adjacent in the content
 * Uses position-based detection when position info is available.
 * Falls back to text-based detection when positions aren't available OR when
 * position-based detection fails AND the gap suggests broken positions.
 */
export function findOverlapOrAdjacent(
  highlightText: string,
  selectedText: string,
  content: string,
  highlightPosition?: SelectionPosition,
  selectionPosition?: SelectionPosition
): boolean {
  const plainContent = stripHtmlWithSpaces(content);

  // Try position-based detection when we have BOTH positions
  if (highlightPosition && selectionPosition) {
    if (arePositionsAdjacentOrOverlapping(highlightPosition, selectionPosition, plainContent)) {
      return true;
    }

    // Position-based detection failed - check if the gap contains part of the highlight text
    // This indicates the stored positions are incorrect (e.g., highlight ends before its actual text ends)
    // Only then fall through to text-based detection
    const gapStart = Math.min(highlightPosition.end, selectionPosition.start);
    const gapEnd = Math.max(highlightPosition.end, selectionPosition.start);
    if (gapEnd > gapStart) {
      const gap = plainContent.slice(gapStart, gapEnd);
      // Check if the gap contains text that is part of the highlight's stored text
      // This indicates broken position data - the highlight text extends beyond its stored endOffset
      const normalizedGap = gap.trim();
      if (normalizedGap.length > 0) {
        // Normalize both for comparison (handle newlines vs spaces at block boundaries)
        const normalizedHighlight = highlightText.replace(/\s+/g, ' ');
        if (normalizedHighlight.includes(normalizedGap) || normalizedGap.split(/\s+/).some(word => normalizedHighlight.includes(word))) {
          // Gap contains text from the highlight - positions are broken, use text-based fallback
          // Fall through to text-based detection below
        } else {
          // Gap contains text NOT from the highlight - positions are correct, they're truly not adjacent
          return false;
        }
      }
    }
  }

  // Text-based detection as primary method (when no positions) or fallback (when positions indicate broken data)
  // First check adjacency (content-aware)
  if (findAdjacent(highlightText, selectedText, content) !== null) {
    return true;
  }

  // Then check for actual overlap in the content
  return findOverlapInContent(highlightText, selectedText, content);
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
    const plainContent = stripHtmlWithSpaces(content);
    const pattern = new RegExp(
      escapeRegex(existing) + '(\\s*)' + escapeRegex(newText)
    );
    const match = plainContent.match(pattern);
    if (match) {
      return existing + (match[1] || '') + newText;
    }
  } else if (adjacency === 'after') {
    // existing comes after newText
    const plainContent = stripHtmlWithSpaces(content);
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
 * Finds the position of text at a specific occurrence (0-indexed)
 * Returns -1 if not found or if occurrence doesn't exist
 */
export function findTextAtPosition(
  plainContent: string,
  text: string,
  targetPosition?: number
): number {
  if (targetPosition === undefined) {
    // No position specified, return first occurrence
    return plainContent.indexOf(text);
  }

  // Find all occurrences
  let searchPos = 0;
  while (searchPos < plainContent.length) {
    const foundPos = plainContent.indexOf(text, searchPos);
    if (foundPos === -1) break;

    // Check if this occurrence contains the target position
    const foundEnd = foundPos + text.length;
    if (targetPosition >= foundPos && targetPosition < foundEnd) {
      return foundPos;
    }

    // If we've passed the target position, the text doesn't exist there
    if (foundPos > targetPosition) {
      break;
    }

    searchPos = foundPos + 1;
  }

  // Target position not within any occurrence, return first occurrence as fallback
  return plainContent.indexOf(text);
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
    const targetPosition = highlight.plainTextStart;

    // Skip empty or whitespace-only highlights
    if (!normalizedText) continue;

    // Skip if this text is already highlighted or contained within a longer highlight
    if (isContainedInHighlighted(normalizedText)) continue;

    // Match in plain text using position-aware matching
    try {
      // Add spaces between block elements so position mapping aligns with browser selections
      const htmlWithSpaces = addSpacesBetweenBlocks(result);
      // Strip HTML tags to get plain text for searching
      const plainContent = htmlWithSpaces.replace(/<[^>]*>/g, '');

      // Find text at the correct position (or first occurrence if no position)
      let plainIndex = findTextAtPosition(plainContent, text, targetPosition);
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
        // Use the HTML with spaces for position mapping so indices align
        const { startHtmlIndex, endHtmlIndex } = mapPlainToHtmlPosition(htmlWithSpaces, plainIndex, matchLength);

        if (startHtmlIndex !== -1 && endHtmlIndex !== -1) {
          const matchedText = htmlWithSpaces.slice(startHtmlIndex, endHtmlIndex);
          const matchedPlain = matchedText.replace(/<[^>]*>/g, '');

          // Verify the match by comparing normalized text
          if (normalizeWhitespace(matchedPlain) === normalizedText) {
            const replacement = wrapWithMark(matchedText, highlightId);
            // Apply the replacement to htmlWithSpaces and update result with it
            result = htmlWithSpaces.slice(0, startHtmlIndex) + replacement + htmlWithSpaces.slice(endHtmlIndex);
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
