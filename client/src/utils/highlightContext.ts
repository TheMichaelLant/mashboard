/**
 * Extracts context around a highlighted text from post content
 */
export function getHighlightContext(
  postContent: string | undefined,
  selectedText: string,
  contextLength = 50
): { before: string; after: string } {
  if (!postContent) return { before: '', after: '' };

  // Strip HTML tags for plain text matching
  const plainContent = postContent.replace(/<[^>]*>/g, '');
  const highlightIndex = plainContent.indexOf(selectedText);

  if (highlightIndex === -1) return { before: '', after: '' };

  // Get text before the highlight
  const beforeStart = Math.max(0, highlightIndex - contextLength);
  let beforeText = plainContent.slice(beforeStart, highlightIndex).trim();

  // Find a word boundary for cleaner context
  if (beforeStart > 0) {
    const spaceIndex = beforeText.indexOf(' ');
    if (spaceIndex !== -1) {
      beforeText = beforeText.slice(spaceIndex + 1);
    }
    beforeText = '...' + beforeText;
  }

  // Get text after the highlight
  const afterStart = highlightIndex + selectedText.length;
  let afterText = plainContent.slice(afterStart, afterStart + contextLength).trim();

  // Find a word boundary for cleaner context
  if (afterStart + contextLength < plainContent.length) {
    const lastSpaceIndex = afterText.lastIndexOf(' ');
    if (lastSpaceIndex !== -1) {
      afterText = afterText.slice(0, lastSpaceIndex);
    }
    afterText = afterText + '...';
  }

  return { before: beforeText, after: afterText };
}
