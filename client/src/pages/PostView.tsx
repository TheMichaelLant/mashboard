import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import {
  Heart,
  Bookmark,
  Archive,
  Share2,
  Lock,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  Highlighter,
  Eye,
  EyeOff,
  X,
  XCircle,
  Maximize2,
} from 'lucide-react';
import {
  postApi,
  appreciationApi,
  bookmarkApi,
  highlightApi,
  subscriptionApi,
} from '../services/api';
import type { Post, Highlight } from '../types';
import { useHighlightMode } from '../contexts/HighlightModeContext';
import {
  processHighlights,
  findOverlapOrAdjacent,
  mergeTexts,
  SelectionPosition,
  stripHtmlWithSpaces,
} from '../utils/highlightProcessor';

// Debug logging only in development
const DEBUG_HIGHLIGHTS = import.meta.env.DEV;

/**
 * Block-level tags that should have spaces between them (matching highlightProcessor)
 */
const BLOCK_TAGS = new Set([
  'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'HR', 'BR',
  'TABLE', 'TR', 'TD', 'TH', 'THEAD', 'TBODY', 'TFOOT',
  'ARTICLE', 'SECTION', 'HEADER', 'FOOTER', 'NAV', 'ASIDE',
  'FIGURE', 'FIGCAPTION', 'MAIN', 'ADDRESS', 'DD', 'DL', 'DT',
]);

/**
 * Finds the closest block-level ancestor of a node
 */
function getClosestBlockAncestor(node: Node, container: Element): Element | null {
  let current: Element | null = node.parentElement;
  while (current && current !== container) {
    if (BLOCK_TAGS.has(current.tagName)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * Calculates the plain text offset from the start of a container element to a specific node/offset
 * Accounts for spaces between block elements (matching stripHtmlWithSpaces behavior)
 */
function getPlainTextOffset(containerElement: Element, targetNode: Node, targetOffset: number): number {
  let offset = 0;
  let prevTextNode: Node | null = null;
  let prevBlockAncestor: Element | null = null;

  const walker = document.createTreeWalker(
    containerElement,
    NodeFilter.SHOW_TEXT,
    null
  );

  let currentNode = walker.nextNode();
  while (currentNode) {
    // Check if we crossed a block boundary
    const currBlockAncestor = getClosestBlockAncestor(currentNode, containerElement);

    if (prevTextNode && prevBlockAncestor !== currBlockAncestor) {
      // We crossed from one block element to another - add a space
      offset += 1;
    }

    if (currentNode === targetNode) {
      return offset + targetOffset;
    }

    offset += (currentNode.textContent || '').length;
    prevTextNode = currentNode;
    prevBlockAncestor = currBlockAncestor;

    currentNode = walker.nextNode();
  }

  // If target node not found, return -1
  return -1;
}

/**
 * Gets the plain text position of a Range relative to a container element
 */
function getRangePositionInPlainText(
  containerElement: Element,
  range: Range
): SelectionPosition | null {
  const start = getPlainTextOffset(containerElement, range.startContainer, range.startOffset);
  const end = getPlainTextOffset(containerElement, range.endContainer, range.endOffset);

  if (start === -1 || end === -1) return null;

  return { start, end };
}

export default function PostView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userId, isSignedIn } = useAuth();
  const { isHighlightMode } = useHighlightMode();
  const highlightTextParam = searchParams.get('highlight');

  const [post, setPost] = useState<Post | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [isCreatingHighlight, setIsCreatingHighlight] = useState(false);
  const [overlappingHighlights, setOverlappingHighlights] = useState<Highlight[]>([]);
  const [selectedText, setSelectedText] = useState<{
    text: string;
    start: number;
    end: number;
    /** Plain text position of selection start */
    plainTextStart?: number;
    /** Plain text position of selection end */
    plainTextEnd?: number;
  } | null>(null);
  const articleRef = useRef<HTMLElement>(null);
  const [showHighlightMenu, setShowHighlightMenu] = useState(false);
  const [highlightPosition, setHighlightPosition] = useState({ x: 0, y: 0 });
  const [showHighlightsInContent, setShowHighlightsInContent] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredHighlightId, setHoveredHighlightId] = useState<number | null>(null);
  const [deleteButtonPosition, setDeleteButtonPosition] = useState<{ x: number; y: number } | null>(null);
  const highlightMenuRef = useRef<HTMLDivElement>(null);

  // Calculate current content (moved early for use in callbacks)
  const currentContent =
    post?.type === 'book' && post?.chapters?.length
      ? post.chapters[currentChapter]?.content
      : post?.content || '';

  useEffect(() => {
    const fetchPost = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await postApi.getById(parseInt(id));
        setPost(data);

        // Fetch user's highlights for this post
        if (isSignedIn) {
          const userHighlights = await highlightApi.getPostHighlights(parseInt(id));
          setHighlights(userHighlights);
        }
      } catch (error) {
        console.error('Failed to fetch post:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [id, isSignedIn]);

  // Scroll to highlighted text when coming from library
  useEffect(() => {
    if (!highlightTextParam || loading) return;

    // Wait for content to render
    const timeoutId = setTimeout(() => {
      // Find all highlight marks
      const marks = document.querySelectorAll('.highlight-mark');

      // Normalize text for comparison (collapse whitespace)
      const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim();
      const highlightStart = normalizeText(highlightTextParam).slice(0, 30);

      for (const mark of marks) {
        const markText = normalizeText(mark.textContent || '');

        // Check if this mark contains the start of our highlight
        // OR if our highlight starts with this mark's text (for split highlights)
        const isMatch = markText.includes(highlightStart) ||
                        highlightStart.startsWith(markText.slice(0, 15));

        if (isMatch) {
          // Scroll to the element
          mark.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Get the highlight ID and flash all marks with the same ID
          const highlightId = mark.getAttribute('data-highlight-id');
          if (highlightId) {
            const relatedMarks = document.querySelectorAll(`[data-highlight-id="${highlightId}"]`);
            relatedMarks.forEach(m => m.classList.add('highlight-flash'));
          } else {
            // Fallback: just flash this mark
            mark.classList.add('highlight-flash');
          }

          setTimeout(() => {
            document.querySelectorAll('.highlight-flash').forEach(el => {
              el.classList.remove('highlight-flash');
            });
          }, 2000);

          // Clear the search param after scrolling
          setSearchParams({}, { replace: true });
          break;
        }
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [highlightTextParam, loading, setSearchParams]);

  // Handle group hover for split highlights (marks with same data-highlight-id)
  // Also positions the delete button at the tail end of the highlight
  useEffect(() => {
    const handleMarkHover = (e: Event) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList?.contains('highlight-mark')) return;

      const highlightId = target.dataset.highlightId;
      if (!highlightId) return;

      // Add hover class to all marks with the same highlight ID
      const relatedMarks = document.querySelectorAll(`[data-highlight-id="${highlightId}"]`);
      relatedMarks.forEach(m => m.classList.add('highlight-group-hover'));

      // Find the last mark (tail end) and position delete button there
      const lastMark = relatedMarks[relatedMarks.length - 1];
      if (lastMark) {
        const rect = lastMark.getBoundingClientRect();
        setDeleteButtonPosition({
          x: rect.right - 10,
          y: rect.top + rect.height / 2,
        });
        setHoveredHighlightId(parseInt(highlightId));
      }
    };

    const handleMarkLeave = (e: Event) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList?.contains('highlight-mark')) return;

      const highlightId = target.dataset.highlightId;
      if (!highlightId) return;

      // Check if we're moving to another mark with the same highlight ID
      const relatedEvent = e as MouseEvent;
      const relatedTarget = relatedEvent.relatedTarget;
      if (relatedTarget instanceof HTMLElement) {
        if (relatedTarget.classList?.contains('highlight-mark') &&
            relatedTarget.dataset.highlightId === highlightId) {
          return; // Still within the same highlight group
        }
        // Check if moving to the delete button
        if (relatedTarget.closest('.highlight-delete-btn')) {
          return; // Moving to delete button, keep showing
        }
      }

      // Remove hover class from all marks with the same highlight ID
      const relatedMarks = document.querySelectorAll(`[data-highlight-id="${highlightId}"]`);
      relatedMarks.forEach(m => m.classList.remove('highlight-group-hover'));

      // Hide delete button
      setHoveredHighlightId(null);
      setDeleteButtonPosition(null);
    };

    // Use event delegation on the article content
    document.addEventListener('mouseenter', handleMarkHover, true);
    document.addEventListener('mouseleave', handleMarkLeave, true);

    return () => {
      document.removeEventListener('mouseenter', handleMarkHover, true);
      document.removeEventListener('mouseleave', handleMarkLeave, true);
    };
  }, []);

  // Track dragging state to suppress delete button during text selection
  useEffect(() => {
    const handleMouseDown = () => {
      setIsDragging(true);
      // Hide delete button when starting to drag
      setHoveredHighlightId(null);
      setDeleteButtonPosition(null);
    };

    const handleMouseUp = () => {
      // Small delay to allow text selection to complete
      setTimeout(() => {
        setIsDragging(false);
      }, 100);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Close highlight menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        highlightMenuRef.current &&
        !highlightMenuRef.current.contains(event.target as Node)
      ) {
        setShowHighlightMenu(false);
        setOverlappingHighlights([]);
        window.getSelection()?.removeAllRanges();
      }
    };

    if (showHighlightMenu) {
      // Use setTimeout to avoid immediately closing when the menu opens
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showHighlightMenu]);

  const handleAppreciate = async () => {
    if (!post || !isSignedIn) return;
    try {
      if (post.isAppreciated) {
        await appreciationApi.unappreciate(post.id);
      } else {
        await appreciationApi.appreciate(post.id);
      }
      setPost((prev) =>
        prev
          ? {
              ...prev,
              isAppreciated: !prev.isAppreciated,
              appreciationCount: prev.isAppreciated
                ? (prev.appreciationCount || 1) - 1
                : (prev.appreciationCount || 0) + 1,
            }
          : null
      );
    } catch (error) {
      console.error('Failed to toggle appreciation:', error);
    }
  };

  const handleBookmark = async () => {
    if (!post || !isSignedIn) return;
    try {
      if (post.isBookmarked) {
        await bookmarkApi.unbookmark(post.id);
      } else {
        await bookmarkApi.bookmark(post.id);
      }
      setPost((prev) =>
        prev ? { ...prev, isBookmarked: !prev.isBookmarked } : null
      );
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    }
  };

  const handleArchive = async () => {
    if (!post || !isSignedIn || post.type !== 'book') return;
    try {
      if (post.isArchived) {
        await bookmarkApi.unarchive(post.id);
      } else {
        await bookmarkApi.archive(post.id);
      }
      setPost((prev) =>
        prev ? { ...prev, isArchived: !prev.isArchived } : null
      );
    } catch (error) {
      console.error('Failed to toggle archive:', error);
    }
  };

  // Helper function to check if selected text is contained within an existing highlight
  // Returns the position: 'start', 'middle', 'end', or null if not contained
  // Uses position-based checking when position info is available
  const getContainmentPosition = useCallback((
    highlight: Highlight,
    selection: string,
    selectionStart?: number,
    selectionEnd?: number
  ): 'start' | 'middle' | 'end' | null => {
    // Use position-based containment check when we have position info
    if (selectionStart !== undefined && selectionEnd !== undefined &&
        highlight.startOffset !== undefined && highlight.endOffset !== undefined) {
      // Check if selection is fully contained within the highlight's position range
      const isContained = selectionStart >= highlight.startOffset && selectionEnd <= highlight.endOffset;
      if (!isContained) return null;

      // Check position within highlight
      if (selectionStart === highlight.startOffset) return 'start';
      if (selectionEnd === highlight.endOffset) return 'end';
      return 'middle';
    }

    // Fall back to text-based check when positions aren't available
    const highlightText = highlight.selectedText;

    // Check if selection is fully contained within the highlight
    if (!highlightText.includes(selection)) return null;

    // Check if selection is at the start
    if (highlightText.startsWith(selection)) return 'start';

    // Check if selection is at the end
    if (highlightText.endsWith(selection)) return 'end';

    // Selection is in the middle
    return 'middle';
  }, []);

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();

    // Only allow highlighting when highlight mode is active
    if (!isHighlightMode || !selection || selection.isCollapsed || !isSignedIn || post?.isLocked) {
      setShowHighlightMenu(false);
      setOverlappingHighlights([]);
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 0 && articleRef.current) {
      const range = selection.getRangeAt(0);

      // Get the prose container (the actual content container, not the article wrapper)
      const proseContainer = articleRef.current.querySelector('.prose') || articleRef.current;

      // Only allow selections that are at least partially within the post content area
      // If selection is entirely outside the post, ignore it
      const startInPost = proseContainer.contains(range.startContainer);
      const endInPost = proseContainer.contains(range.endContainer);
      if (!startInPost && !endInPost) {
        setShowHighlightMenu(false);
        setOverlappingHighlights([]);
        return;
      }

      const rect = range.getBoundingClientRect();

      // Calculate plain text position of the selection
      // IMPORTANT: We need positions based on the ORIGINAL content (before processHighlights adds spaces)
      // The DOM position is affected by processHighlights modifications, so we recalculate
      // using the original content's plain text representation
      const domPosition = getRangePositionInPlainText(proseContainer, range);

      // Get the original plain text (same as what highlights were stored against)
      const originalPlainText = stripHtmlWithSpaces(currentContent);

      // Normalize selected text: replace newlines with spaces to match stripHtmlWithSpaces behavior
      // Browser selections across block elements contain newlines, but our plain text uses spaces
      const normalizedText = text.replace(/\n+/g, ' ');

      // Find the selection text in the original content
      // Use the DOM position as a hint to find the closest occurrence
      let plainTextPosition: SelectionPosition | null = null;
      const textOccurrences: number[] = [];
      let searchStart = 0;
      while (true) {
        const idx = originalPlainText.indexOf(normalizedText, searchStart);
        if (idx === -1) break;
        textOccurrences.push(idx);
        searchStart = idx + 1;
      }

      if (textOccurrences.length === 1) {
        // Only one occurrence, use it directly
        plainTextPosition = { start: textOccurrences[0], end: textOccurrences[0] + normalizedText.length };
      } else if (textOccurrences.length > 1 && domPosition) {
        // Multiple occurrences - find the one closest to the DOM position
        const closest = textOccurrences.reduce((prev, curr) => {
          const prevDiff = Math.abs(prev - domPosition.start);
          const currDiff = Math.abs(curr - domPosition.start);
          return currDiff < prevDiff ? curr : prev;
        });
        plainTextPosition = { start: closest, end: closest + normalizedText.length };
      } else if (textOccurrences.length > 1) {
        // Multiple occurrences, no DOM hint - use first occurrence
        plainTextPosition = { start: textOccurrences[0], end: textOccurrences[0] + normalizedText.length };
      }

      // Check if this text overlaps OR is adjacent to ANY existing highlights
      // Use position-aware detection when we have position info for the selection
      const selectionPos = plainTextPosition || undefined;

      if (DEBUG_HIGHLIGHTS) {
        console.log('=== Selection Debug ===');
        console.log('Selected text:', JSON.stringify(text));
        console.log('Selection position:', selectionPos);
      }

      const overlapping = highlights.filter((h) => {
        const highlightPos = h.startOffset !== undefined && h.endOffset !== undefined
          ? { start: h.startOffset, end: h.endOffset } as SelectionPosition
          : undefined;

        if (DEBUG_HIGHLIGHTS) {
          console.log('Checking highlight:', h.id, JSON.stringify(h.selectedText?.substring(0, 30)));
          console.log('  Highlight pos:', highlightPos);
          if (highlightPos && selectionPos) {
            const gap = originalPlainText.slice(
              Math.min(highlightPos.end, selectionPos.start),
              Math.max(highlightPos.end, selectionPos.start)
            );
            console.log('  Gap:', JSON.stringify(gap));
          }
        }

        const result = findOverlapOrAdjacent(h.selectedText, text, currentContent, highlightPos, selectionPos);
        if (DEBUG_HIGHLIGHTS) {
          console.log('  Result:', result);
        }
        return result;
      });
      setOverlappingHighlights(overlapping);

      setSelectedText({
        text,
        start: range.startOffset,
        end: range.endOffset,
        plainTextStart: plainTextPosition?.start,
        plainTextEnd: plainTextPosition?.end,
      });
      setHighlightPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      });
      setShowHighlightMenu(true);
    }
  }, [isSignedIn, post?.isLocked, isHighlightMode, highlights, currentContent]);

  const handleCreateHighlight = async () => {
    // Prevent double-click and validate
    if (!post || !selectedText || !isSignedIn || isCreatingHighlight) return;

    // Check for overlap or adjacency - don't allow, user should use "Extend" instead
    const selectionPos = selectedText.plainTextStart !== undefined && selectedText.plainTextEnd !== undefined
      ? { start: selectedText.plainTextStart, end: selectedText.plainTextEnd } as SelectionPosition
      : undefined;
    const hasOverlapOrAdjacent = highlights.some((h) => {
      const highlightPos = h.startOffset !== undefined && h.endOffset !== undefined
        ? { start: h.startOffset, end: h.endOffset } as SelectionPosition
        : undefined;
      return findOverlapOrAdjacent(h.selectedText, selectedText.text, currentContent, highlightPos, selectionPos);
    });
    if (hasOverlapOrAdjacent) {
      // If there's an overlap or adjacency, user should use "Extend" instead
      setShowHighlightMenu(false);
      window.getSelection()?.removeAllRanges();
      return;
    }

    setIsCreatingHighlight(true);
    try {
      // Use plain text positions for startOffset/endOffset to enable position-aware highlighting
      const newHighlight = await highlightApi.create({
        postId: post.id,
        chapterId: post.type === 'book' ? post.chapters?.[currentChapter]?.id : undefined,
        selectedText: selectedText.text,
        startOffset: selectedText.plainTextStart ?? selectedText.start,
        endOffset: selectedText.plainTextEnd ?? selectedText.end,
      });
      setHighlights((prev) => [...prev, newHighlight]);
      setShowHighlightMenu(false);
      setOverlappingHighlights([]);
      window.getSelection()?.removeAllRanges();
      // Optionally turn off highlight mode after creating
      // setHighlightMode(false);
    } catch (error) {
      console.error('Failed to create highlight:', error);
    } finally {
      setIsCreatingHighlight(false);
    }
  };

  const handleDeleteHighlight = async (highlightId: number) => {
    try {
      await highlightApi.delete(highlightId);
      setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
    } catch (error) {
      console.error('Failed to delete highlight:', error);
    }
  };

  const handleExtendHighlight = async () => {
    if (!post || !selectedText || !isSignedIn || overlappingHighlights.length === 0 || isCreatingHighlight) return;

    // Merge all overlapping/adjacent highlights with the new selection
    // Normalize selection text: replace newlines with spaces to match content format
    let mergedText = selectedText.text.replace(/\n+/g, ' ');

    if (DEBUG_HIGHLIGHTS) {
      console.log('=== Extend Debug ===');
      console.log('Initial mergedText:', JSON.stringify(mergedText));
    }

    for (const highlight of overlappingHighlights) {
      const normalizedHighlight = highlight.selectedText.replace(/\n+/g, ' ');
      if (DEBUG_HIGHLIGHTS) {
        console.log('Merging with highlight:', JSON.stringify(normalizedHighlight.substring(0, 50)));
      }
      mergedText = mergeTexts(mergedText, normalizedHighlight, currentContent);
      if (DEBUG_HIGHLIGHTS) {
        console.log('After merge:', JSON.stringify(mergedText.substring(0, 80)));
      }
    }

    // If only one highlight and merged text is same as existing (normalized), nothing to do
    const normalizedExisting = overlappingHighlights[0].selectedText.replace(/\n+/g, ' ');
    if (overlappingHighlights.length === 1 && mergedText === normalizedExisting) {
      if (DEBUG_HIGHLIGHTS) {
        console.log('Merged text same as existing, skipping');
      }
      setShowHighlightMenu(false);
      window.getSelection()?.removeAllRanges();
      return;
    }

    // Calculate the merged highlight's position by finding min start and max end
    // across all overlapping highlights and the current selection
    let mergedStart = selectedText.plainTextStart ?? selectedText.start;
    let mergedEnd = selectedText.plainTextEnd ?? selectedText.end;
    for (const h of overlappingHighlights) {
      if (h.startOffset !== undefined && h.endOffset !== undefined) {
        if (h.startOffset < mergedStart) {
          mergedStart = h.startOffset;
        }
        if (h.endOffset > mergedEnd) {
          mergedEnd = h.endOffset;
        }
      }
    }

    setIsCreatingHighlight(true);
    try {
      // Delete all old overlapping highlights
      const highlightIdsToDelete = overlappingHighlights.map((h) => h.id);
      await Promise.all(highlightIdsToDelete.map((id) => highlightApi.delete(id)));

      // Create a new highlight with the merged text and correct position
      const newHighlight = await highlightApi.create({
        postId: post.id,
        chapterId: post.type === 'book' ? post.chapters?.[currentChapter]?.id : undefined,
        selectedText: mergedText,
        startOffset: mergedStart,
        endOffset: mergedEnd,
      });

      // Update state: remove all old highlights, add new one
      setHighlights((prev) => [
        ...prev.filter((h) => !highlightIdsToDelete.includes(h.id)),
        newHighlight,
      ]);
      setShowHighlightMenu(false);
      setOverlappingHighlights([]);
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      console.error('Failed to extend highlight:', error);
    } finally {
      setIsCreatingHighlight(false);
    }
  };

  // Handle shrinking a highlight (removing selected portion from start or end)
  const handleShrinkHighlight = async () => {
    const existingHighlight = overlappingHighlights[0];
    if (!post || !selectedText || !isSignedIn || !existingHighlight || isCreatingHighlight) return;

    const position = getContainmentPosition(
      existingHighlight,
      selectedText.text,
      selectedText.plainTextStart,
      selectedText.plainTextEnd
    );
    if (!position || position === 'middle') return; // Can only shrink from start/end

    setIsCreatingHighlight(true);
    try {
      let newText: string;
      let newStartOffset: number;
      let newEndOffset: number;

      if (position === 'start') {
        // Remove from beginning - shift start offset forward
        newText = existingHighlight.selectedText.slice(selectedText.text.length);
        newStartOffset = existingHighlight.startOffset + selectedText.text.length;
        newEndOffset = existingHighlight.endOffset;
      } else {
        // Remove from end - shift end offset backward
        newText = existingHighlight.selectedText.slice(0, -selectedText.text.length);
        newStartOffset = existingHighlight.startOffset;
        newEndOffset = existingHighlight.endOffset - selectedText.text.length;
      }

      // Delete the old highlight
      await highlightApi.delete(existingHighlight.id);

      // Only create new if there's remaining text
      if (newText.trim().length > 0) {
        const newHighlight = await highlightApi.create({
          postId: post.id,
          chapterId: post.type === 'book' ? post.chapters?.[currentChapter]?.id : undefined,
          selectedText: newText,
          startOffset: newStartOffset,
          endOffset: newEndOffset,
        });
        setHighlights((prev) => [
          ...prev.filter((h) => h.id !== existingHighlight.id),
          newHighlight,
        ]);
      } else {
        // No remaining text, just remove the highlight
        setHighlights((prev) => prev.filter((h) => h.id !== existingHighlight.id));
      }

      setShowHighlightMenu(false);
      setOverlappingHighlights([]);
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      console.error('Failed to shrink highlight:', error);
    } finally {
      setIsCreatingHighlight(false);
    }
  };

  // Handle splitting a highlight (removing selected portion from middle)
  const handleSplitHighlight = async () => {
    const existingHighlight = overlappingHighlights[0];
    if (!post || !selectedText || !isSignedIn || !existingHighlight || isCreatingHighlight) return;

    const position = getContainmentPosition(
      existingHighlight,
      selectedText.text,
      selectedText.plainTextStart,
      selectedText.plainTextEnd
    );
    if (position !== 'middle') return; // Can only split if selection is in middle

    setIsCreatingHighlight(true);
    try {
      // Use position-based splitting when we have position info
      // This is more reliable than text-based indexOf when whitespace differs
      const selStart = selectedText.plainTextStart;
      const selEnd = selectedText.plainTextEnd;
      const hlStart = existingHighlight.startOffset;
      const hlEnd = existingHighlight.endOffset;

      if (DEBUG_HIGHLIGHTS) {
        console.log('=== Split Debug ===');
        console.log('Highlight positions:', hlStart, '-', hlEnd);
        console.log('Selection positions:', selStart, '-', selEnd);
      }

      // Get the plain text to extract the before/after portions
      const plainText = stripHtmlWithSpaces(currentContent);

      let textBefore: string;
      let textAfter: string;
      let beforeEnd: number;
      let afterStart: number;

      if (selStart !== undefined && selEnd !== undefined &&
          hlStart !== undefined && hlEnd !== undefined) {
        // Position-based split: use positions directly
        textBefore = plainText.slice(hlStart, selStart);
        textAfter = plainText.slice(selEnd, hlEnd);
        beforeEnd = selStart;
        afterStart = selEnd;
        if (DEBUG_HIGHLIGHTS) {
          console.log('Using position-based split');
          console.log('Text before:', JSON.stringify(textBefore.substring(0, 50)));
          console.log('Text after:', JSON.stringify(textAfter.substring(0, 50)));
        }
      } else {
        // Fallback to text-based split (normalize whitespace first)
        const fullText = existingHighlight.selectedText.replace(/\n+/g, ' ');
        const normalizedSelection = selectedText.text.replace(/\n+/g, ' ');
        const selectionIndex = fullText.indexOf(normalizedSelection);

        if (DEBUG_HIGHLIGHTS) {
          console.log('Using text-based split');
          console.log('Full text:', JSON.stringify(fullText.substring(0, 50)));
          console.log('Selection:', JSON.stringify(normalizedSelection.substring(0, 50)));
          console.log('Selection index:', selectionIndex);
        }

        if (selectionIndex === -1) {
          console.error('Could not find selection in highlight text');
          return;
        }

        textBefore = fullText.slice(0, selectionIndex);
        textAfter = fullText.slice(selectionIndex + normalizedSelection.length);
        beforeEnd = (existingHighlight.startOffset ?? 0) + selectionIndex;
        afterStart = beforeEnd + normalizedSelection.length;
      }

      // Delete the old highlight
      await highlightApi.delete(existingHighlight.id);

      const newHighlights: Highlight[] = [];

      // Create first highlight (text before selection)
      if (textBefore.trim().length > 0) {
        const highlight1 = await highlightApi.create({
          postId: post.id,
          chapterId: post.type === 'book' ? post.chapters?.[currentChapter]?.id : undefined,
          selectedText: textBefore,
          startOffset: hlStart,
          endOffset: beforeEnd,
        });
        newHighlights.push(highlight1);
      }

      // Create second highlight (text after selection)
      if (textAfter.trim().length > 0) {
        const highlight2 = await highlightApi.create({
          postId: post.id,
          chapterId: post.type === 'book' ? post.chapters?.[currentChapter]?.id : undefined,
          selectedText: textAfter,
          startOffset: afterStart,
          endOffset: hlEnd,
        });
        newHighlights.push(highlight2);
      }

      // Update highlights state
      setHighlights((prev) => [
        ...prev.filter((h) => h.id !== existingHighlight.id),
        ...newHighlights,
      ]);

      setShowHighlightMenu(false);
      setOverlappingHighlights([]);
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      console.error('Failed to split highlight:', error);
    } finally {
      setIsCreatingHighlight(false);
    }
  };

  const handleSubscribe = async () => {
    if (!post || !isSignedIn) return;
    try {
      await subscriptionApi.subscribe(post.authorId);
      // Refetch post to update access
      const data = await postApi.getById(post.id);
      setPost(data);
    } catch (error) {
      console.error('Failed to subscribe:', error);
    }
  };

  const handleDelete = async () => {
    if (!post) return;
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await postApi.delete(post.id);
        navigate('/');
      } catch (error) {
        console.error('Failed to delete post:', error);
      }
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  // Process content to show highlights (must be called before any early returns)
  const processedContent = useMemo(() => {
    if (!currentContent || !showHighlightsInContent) {
      return currentContent;
    }

    return processHighlights({
      content: currentContent,
      highlights: highlights.map(h => ({
        id: h.id,
        selectedText: h.selectedText,
        plainTextStart: h.startOffset,
        plainTextEnd: h.endOffset,
      })),
    });
  }, [currentContent, highlights, showHighlightsInContent]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-12 animate-pulse">
        <div className="h-12 bg-ink-700 rounded w-3/4 mb-4" />
        <div className="h-4 bg-ink-700 rounded w-1/4 mb-8" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 bg-ink-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-display font-bold text-ink-100 mb-2">
          Post not found
        </h2>
        <p className="text-ink-400 mb-6">
          The post you're looking for doesn't exist or has been removed.
        </p>
        <Link to="/discover" className="btn btn-primary">
          Discover Posts
        </Link>
      </div>
    );
  }

  const isOwner = userId === post.authorId;

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      {/* Back Link */}
      <Link
        to={-1 as unknown as string}
        onClick={(e) => {
          e.preventDefault();
          navigate(-1);
        }}
        className="inline-flex items-center text-ink-400 hover:text-gold-600 mb-8 transition-colors"
      >
        <ChevronLeft size={20} />
        <span>Back</span>
      </Link>

      {/* Post Header */}
      <header className="mb-8">
        {post.title && (
          <h1 className="text-4xl md:text-5xl font-display font-bold text-ink-50 mb-6 leading-tight">
            {post.title}
          </h1>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {post.author?.avatarUrl ? (
              <img
                src={post.author.avatarUrl}
                alt={post.author.displayName}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-ink-700 flex items-center justify-center">
                <span className="text-ink-300 font-medium text-lg">
                  {post.author?.displayName?.charAt(0) || '?'}
                </span>
              </div>
            )}
            <div>
              <Link
                to={`/@${post.author?.username}`}
                className="font-medium text-ink-200 hover:text-gold-600 transition-colors"
              >
                {post.author?.displayName}
              </Link>
              <p className="text-sm text-ink-500">
                {new Date(post.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
          {isOwner && (
            <div className="flex items-center space-x-2">
              <Link
                to={`/edit/${post.id}`}
                className="btn btn-ghost btn-sm"
              >
                <Edit size={16} className="mr-1" />
                Edit
              </Link>
              <button
                onClick={handleDelete}
                className="btn btn-ghost btn-sm text-red-400 hover:text-red-300 hover:bg-red-900/30"
              >
                <Trash2 size={16} className="mr-1" />
                Delete
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Categories */}
      {post.categories && post.categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {post.categories.map(({ category }) => (
            <Link
              key={category.id}
              to={`/discover/category/${category.slug}`}
              className="text-sm px-3 py-1 bg-ink-800 text-ink-300 rounded-full hover:bg-ink-700 hover:text-gold-500 transition-colors"
            >
              #{category.name}
            </Link>
          ))}
        </div>
      )}

      {/* Book Chapter Navigation */}
      {post.type === 'book' && post.chapters && post.chapters.length > 0 && (
        <div className="bg-ink-800/50 border border-ink-700 rounded-xl p-4 mb-8">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentChapter((prev) => Math.max(0, prev - 1))}
              disabled={currentChapter === 0}
              className="btn btn-ghost btn-sm disabled:opacity-50"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <div className="text-center">
              <p className="text-sm text-ink-400">
                Chapter {currentChapter + 1} of {post.chapters.length}
              </p>
              <h2 className="font-medium text-ink-100">
                {post.chapters[currentChapter].title}
              </h2>
            </div>
            <button
              onClick={() =>
                setCurrentChapter((prev) =>
                  Math.min(post.chapters!.length - 1, prev + 1)
                )
              }
              disabled={currentChapter === post.chapters.length - 1}
              className="btn btn-ghost btn-sm disabled:opacity-50"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Locked Content */}
      {post.isLocked ? (
        <div className="bg-ink-800/50 border border-ink-700 rounded-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gold-900/30 flex items-center justify-center mx-auto mb-4">
            <Lock className="text-gold-500" size={32} />
          </div>
          <h2 className="text-xl font-display font-bold text-ink-100 mb-2">
            Premium Content
          </h2>
          <p className="text-ink-400 mb-6">
            {post.excerpt || 'This content is available to subscribers only.'}
          </p>
          {isSignedIn ? (
            <button onClick={handleSubscribe} className="btn btn-primary">
              Subscribe to {post.author?.displayName}
            </button>
          ) : (
            <Link to="/sign-in" className="btn btn-primary">
              Sign in to Subscribe
            </Link>
          )}
        </div>
      ) : (
        /* Post Content */
        <article
          ref={articleRef}
          className={`${
            post.type === 'line'
              ? 'font-display text-3xl md:text-4xl leading-relaxed text-ink-100'
              : 'font-body text-lg leading-relaxed text-ink-200'
          } ${isHighlightMode ? 'cursor-text selection:bg-gold-600/40' : ''}`}
          onMouseUp={handleTextSelection}
        >
          <div
            className="prose prose-invert prose-lg max-w-none prose-headings:text-ink-100 prose-p:text-ink-300 prose-a:text-gold-500 prose-strong:text-ink-100 prose-blockquote:border-gold-600 prose-blockquote:text-ink-400"
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />
        </article>
      )}

      {/* Highlight Menu */}
      {showHighlightMenu && selectedText && (
        <div
          ref={highlightMenuRef}
          className="fixed bg-ink-800 border border-ink-600 text-ink-100 rounded-lg shadow-xl p-2 z-50"
          style={{
            left: highlightPosition.x,
            top: highlightPosition.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {overlappingHighlights.length > 0 ? (
            (() => {
              const firstHighlight = overlappingHighlights[0];
              const containmentPosition = getContainmentPosition(
                firstHighlight,
                selectedText.text,
                selectedText.plainTextStart,
                selectedText.plainTextEnd
              );

              // Check if selection spans DIFFERENT highlights (for merge)
              // Merge requires: selection start in highlight A, selection end in highlight B (A ≠ B)
              const selStart = selectedText.plainTextStart;
              const selEnd = selectedText.plainTextEnd;
              let startHighlight: Highlight | null = null;
              let endHighlight: Highlight | null = null;

              if (selStart !== undefined && selEnd !== undefined) {
                for (const h of overlappingHighlights) {
                  if (h.startOffset !== undefined && h.endOffset !== undefined) {
                    // Check if selection start is inside OR adjacent to this highlight's end
                    // Adjacent means selection start is at or just after highlight end (within 1 char for whitespace)
                    const startInsideOrAdjacentToEnd =
                      (selStart >= h.startOffset && selStart < h.endOffset) || // inside
                      (selStart >= h.endOffset && selStart <= h.endOffset + 1); // adjacent to end

                    // Check if selection end is inside OR adjacent to this highlight's start
                    const endInsideOrAdjacentToStart =
                      (selEnd > h.startOffset && selEnd <= h.endOffset) || // inside
                      (selEnd >= h.startOffset - 1 && selEnd <= h.startOffset); // adjacent to start

                    if (startInsideOrAdjacentToEnd) {
                      startHighlight = h;
                    }
                    if (endInsideOrAdjacentToStart) {
                      endHighlight = h;
                    }
                  }
                }
              }

              // Merge: selection spans from one highlight to a different one
              const shouldMerge = startHighlight && endHighlight && startHighlight.id !== endHighlight.id;

              if (shouldMerge) {
                return (
                  <div className="flex flex-col">
                    <button
                      onClick={handleExtendHighlight}
                      disabled={isCreatingHighlight}
                      className="flex items-center space-x-2 px-3 py-1.5 hover:bg-ink-700 hover:text-gold-500 rounded transition-colors disabled:opacity-50"
                    >
                      <Maximize2 size={16} />
                      <span>{isCreatingHighlight ? 'Merging...' : `Merge ${overlappingHighlights.length} highlights`}</span>
                    </button>
                  </div>
                );
              }

              // Single highlight - exact match - already highlighted
              if (firstHighlight.selectedText === selectedText.text) {
                return (
                  <div className="flex flex-col">
                    <span className="px-3 py-1.5 text-ink-400 text-sm">Already highlighted</span>
                    <button
                      onClick={() => {
                        handleDeleteHighlight(firstHighlight.id);
                        setShowHighlightMenu(false);
                        window.getSelection()?.removeAllRanges();
                      }}
                      className="flex items-center space-x-2 px-3 py-1.5 hover:bg-red-900/30 hover:text-red-400 rounded transition-colors"
                    >
                      <X size={16} />
                      <span>Remove highlight</span>
                    </button>
                  </div>
                );
              }

              // Single highlight - selection is contained within the highlight - shrink or split
              if (containmentPosition) {
                return (
                  <div className="flex flex-col">
                    {containmentPosition === 'middle' ? (
                      // Middle - offer to split
                      <button
                        onClick={handleSplitHighlight}
                        disabled={isCreatingHighlight}
                        className="flex items-center space-x-2 px-3 py-1.5 hover:bg-ink-700 hover:text-gold-500 rounded transition-colors disabled:opacity-50"
                      >
                        <X size={16} />
                        <span>{isCreatingHighlight ? 'Splitting...' : 'Remove & split highlight'}</span>
                      </button>
                    ) : (
                      // Start or end - offer to shrink
                      <button
                        onClick={handleShrinkHighlight}
                        disabled={isCreatingHighlight}
                        className="flex items-center space-x-2 px-3 py-1.5 hover:bg-ink-700 hover:text-gold-500 rounded transition-colors disabled:opacity-50"
                      >
                        <X size={16} />
                        <span>{isCreatingHighlight ? 'Shrinking...' : 'Shrink highlight'}</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        handleDeleteHighlight(firstHighlight.id);
                        setShowHighlightMenu(false);
                        window.getSelection()?.removeAllRanges();
                      }}
                      className="flex items-center space-x-2 px-3 py-1.5 hover:bg-red-900/30 hover:text-red-400 rounded transition-colors"
                    >
                      <Trash2 size={16} />
                      <span>Remove entire highlight</span>
                    </button>
                  </div>
                );
              }

              // Single overlapping highlight - extend or remove
              return (
                <div className="flex flex-col">
                  <button
                    onClick={handleExtendHighlight}
                    disabled={isCreatingHighlight}
                    className="flex items-center space-x-2 px-3 py-1.5 hover:bg-ink-700 hover:text-gold-500 rounded transition-colors disabled:opacity-50"
                  >
                    <Maximize2 size={16} />
                    <span>{isCreatingHighlight ? 'Extending...' : 'Extend highlight'}</span>
                  </button>
                  <button
                    onClick={() => {
                      handleDeleteHighlight(firstHighlight.id);
                      setShowHighlightMenu(false);
                      window.getSelection()?.removeAllRanges();
                    }}
                    className="flex items-center space-x-2 px-3 py-1.5 hover:bg-red-900/30 hover:text-red-400 rounded transition-colors"
                  >
                    <X size={16} />
                    <span>Remove highlight</span>
                  </button>
                </div>
              );
            })()
          ) : (
            // No existing highlight
            <button
              onClick={handleCreateHighlight}
              disabled={isCreatingHighlight}
              className="flex items-center space-x-2 px-3 py-1.5 hover:bg-ink-700 hover:text-gold-500 rounded transition-colors disabled:opacity-50"
            >
              <Highlighter size={16} />
              <span>{isCreatingHighlight ? 'Saving...' : 'Highlight'}</span>
            </button>
          )}
        </div>
      )}

      {/* Hover Delete Button for Highlights */}
      {hoveredHighlightId !== null && deleteButtonPosition && !isDragging && (
        <button
          className="highlight-delete-btn fixed z-50 rounded-full bg-ink-800 border border-ink-600 text-ink-400 hover:text-red-400 hover:border-red-500 hover:bg-red-900/30 transition-colors shadow-lg"
          style={{
            left: deleteButtonPosition.x,
            top: deleteButtonPosition.y,
            transform: 'translate(-50%, -50%)',
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteHighlight(hoveredHighlightId);
            setHoveredHighlightId(null);
            setDeleteButtonPosition(null);
            // Remove hover class from marks
            document.querySelectorAll('.highlight-group-hover').forEach(m => {
              m.classList.remove('highlight-group-hover');
            });
          }}
          onMouseLeave={(e) => {
            // Check if moving back to a highlight mark
            const relatedTarget = e.relatedTarget;
            if (relatedTarget instanceof HTMLElement &&
                relatedTarget.classList?.contains('highlight-mark') &&
                relatedTarget.dataset.highlightId === String(hoveredHighlightId)) {
              return; // Moving back to the highlight, keep showing
            }
            // Hide button and remove hover styling
            setHoveredHighlightId(null);
            setDeleteButtonPosition(null);
            document.querySelectorAll('.highlight-group-hover').forEach(m => {
              m.classList.remove('highlight-group-hover');
            });
          }}
          title="Delete highlight"
        >
          <XCircle size={18} />
        </button>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between mt-10 pt-6 border-t border-ink-700">
        <div className="flex items-center space-x-6">
          <button
            onClick={handleAppreciate}
            disabled={!isSignedIn}
            className={`flex items-center space-x-2 transition-colors ${
              post.isAppreciated
                ? 'text-red-500'
                : 'text-ink-400 hover:text-red-500'
            } disabled:opacity-50`}
          >
            <Heart
              size={24}
              fill={post.isAppreciated ? 'currentColor' : 'none'}
            />
            <span>{post.appreciationCount || 0}</span>
          </button>
          <button
            onClick={handleBookmark}
            disabled={!isSignedIn}
            className={`flex items-center space-x-2 transition-colors ${
              post.isBookmarked
                ? 'text-gold-500'
                : 'text-ink-400 hover:text-gold-500'
            } disabled:opacity-50`}
          >
            <Bookmark
              size={24}
              fill={post.isBookmarked ? 'currentColor' : 'none'}
            />
            <span>{post.isBookmarked ? 'Saved' : 'Save'}</span>
          </button>
          {post.type === 'book' && (
            <button
              onClick={handleArchive}
              disabled={!isSignedIn}
              className={`flex items-center space-x-2 transition-colors ${
                post.isArchived
                  ? 'text-green-500'
                  : 'text-ink-400 hover:text-green-500'
              } disabled:opacity-50`}
            >
              <Archive
                size={24}
                fill={post.isArchived ? 'currentColor' : 'none'}
              />
              <span>Archive</span>
            </button>
          )}
        </div>
        <button
          onClick={handleShare}
          className="flex items-center space-x-2 text-ink-400 hover:text-gold-500 transition-colors"
        >
          <Share2 size={24} />
          <span>Share</span>
        </button>
      </div>

      {/* User's Highlights */}
      {highlights.length > 0 && (
        <div className="mt-10 pt-6 border-t border-ink-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-ink-100">
              Your Highlights ({highlights.length})
            </h3>
            <button
              onClick={() => setShowHighlightsInContent(!showHighlightsInContent)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                showHighlightsInContent
                  ? 'bg-gold-600 text-ink-950'
                  : 'bg-ink-800 text-ink-400 hover:text-ink-200'
              }`}
            >
              {showHighlightsInContent ? (
                <>
                  <Eye size={16} />
                  <span>Showing in text</span>
                </>
              ) : (
                <>
                  <EyeOff size={16} />
                  <span>Hidden in text</span>
                </>
              )}
            </button>
          </div>
          <div className="space-y-3">
            {highlights.map((highlight) => (
              <div
                key={highlight.id}
                className="bg-gold-900/20 border-l-4 border-gold-600 p-4 rounded-r-lg group relative"
              >
                <button
                  onClick={() => handleDeleteHighlight(highlight.id)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg text-ink-500 hover:text-red-400 hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete highlight"
                >
                  <X size={16} />
                </button>
                <p className="text-ink-200 italic pr-8">"{highlight.selectedText}"</p>
                {highlight.note && (
                  <p className="text-ink-400 text-sm mt-2">{highlight.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
