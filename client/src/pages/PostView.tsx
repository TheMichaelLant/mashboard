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
} from '../utils/highlightProcessor';

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
  } | null>(null);
  const [showHighlightMenu, setShowHighlightMenu] = useState(false);
  const [highlightPosition, setHighlightPosition] = useState({ x: 0, y: 0 });
  const [showHighlightsInContent, setShowHighlightsInContent] = useState(true);
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
    };

    const handleMarkLeave = (e: Event) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList?.contains('highlight-mark')) return;

      const highlightId = target.dataset.highlightId;
      if (!highlightId) return;

      // Remove hover class from all marks with the same highlight ID
      const relatedMarks = document.querySelectorAll(`[data-highlight-id="${highlightId}"]`);
      relatedMarks.forEach(m => m.classList.remove('highlight-group-hover'));
    };

    // Use event delegation on the article content
    document.addEventListener('mouseenter', handleMarkHover, true);
    document.addEventListener('mouseleave', handleMarkLeave, true);

    return () => {
      document.removeEventListener('mouseenter', handleMarkHover, true);
      document.removeEventListener('mouseleave', handleMarkLeave, true);
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
  const getContainmentPosition = useCallback((highlight: Highlight, selection: string): 'start' | 'middle' | 'end' | null => {
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
    if (text.length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Check if this text overlaps OR is adjacent to ANY existing highlights
      const overlapping = highlights.filter((h) => findOverlapOrAdjacent(h.selectedText, text, currentContent));
      setOverlappingHighlights(overlapping);

      setSelectedText({
        text,
        start: range.startOffset,
        end: range.endOffset,
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
    const hasOverlapOrAdjacent = highlights.some((h) => findOverlapOrAdjacent(h.selectedText, selectedText.text, currentContent));
    if (hasOverlapOrAdjacent) {
      // If there's an overlap or adjacency, user should use "Extend" instead
      setShowHighlightMenu(false);
      window.getSelection()?.removeAllRanges();
      return;
    }

    setIsCreatingHighlight(true);
    try {
      const newHighlight = await highlightApi.create({
        postId: post.id,
        chapterId: post.type === 'book' ? post.chapters?.[currentChapter]?.id : undefined,
        selectedText: selectedText.text,
        startOffset: selectedText.start,
        endOffset: selectedText.end,
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
    let mergedText = selectedText.text;
    for (const highlight of overlappingHighlights) {
      mergedText = mergeTexts(mergedText, highlight.selectedText, currentContent);
    }

    // If only one highlight and merged text is same as existing, nothing to do
    if (overlappingHighlights.length === 1 && mergedText === overlappingHighlights[0].selectedText) {
      setShowHighlightMenu(false);
      window.getSelection()?.removeAllRanges();
      return;
    }

    setIsCreatingHighlight(true);
    try {
      // Delete all old overlapping highlights
      const highlightIdsToDelete = overlappingHighlights.map((h) => h.id);
      await Promise.all(highlightIdsToDelete.map((id) => highlightApi.delete(id)));

      // Create a new highlight with the merged text
      const newHighlight = await highlightApi.create({
        postId: post.id,
        chapterId: post.type === 'book' ? post.chapters?.[currentChapter]?.id : undefined,
        selectedText: mergedText,
        startOffset: selectedText.start,
        endOffset: selectedText.end,
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

    const position = getContainmentPosition(existingHighlight, selectedText.text);
    if (!position || position === 'middle') return; // Can only shrink from start/end

    setIsCreatingHighlight(true);
    try {
      let newText: string;
      if (position === 'start') {
        // Remove from beginning
        newText = existingHighlight.selectedText.slice(selectedText.text.length);
      } else {
        // Remove from end
        newText = existingHighlight.selectedText.slice(0, -selectedText.text.length);
      }

      // Delete the old highlight
      await highlightApi.delete(existingHighlight.id);

      // Only create new if there's remaining text
      if (newText.trim().length > 0) {
        const newHighlight = await highlightApi.create({
          postId: post.id,
          chapterId: post.type === 'book' ? post.chapters?.[currentChapter]?.id : undefined,
          selectedText: newText,
          startOffset: selectedText.start,
          endOffset: selectedText.end,
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

    const position = getContainmentPosition(existingHighlight, selectedText.text);
    if (position !== 'middle') return; // Can only split if selection is in middle

    setIsCreatingHighlight(true);
    try {
      const fullText = existingHighlight.selectedText;
      const selectionIndex = fullText.indexOf(selectedText.text);

      // Get the two parts: before and after the selection
      const textBefore = fullText.slice(0, selectionIndex);
      const textAfter = fullText.slice(selectionIndex + selectedText.text.length);

      // Delete the old highlight
      await highlightApi.delete(existingHighlight.id);

      const newHighlights: Highlight[] = [];

      // Create first highlight (text before selection)
      if (textBefore.trim().length > 0) {
        const highlight1 = await highlightApi.create({
          postId: post.id,
          chapterId: post.type === 'book' ? post.chapters?.[currentChapter]?.id : undefined,
          selectedText: textBefore,
          startOffset: existingHighlight.startOffset,
          endOffset: existingHighlight.startOffset + textBefore.length,
        });
        newHighlights.push(highlight1);
      }

      // Create second highlight (text after selection)
      if (textAfter.trim().length > 0) {
        const highlight2 = await highlightApi.create({
          postId: post.id,
          chapterId: post.type === 'book' ? post.chapters?.[currentChapter]?.id : undefined,
          selectedText: textAfter,
          startOffset: existingHighlight.startOffset + selectionIndex + selectedText.text.length,
          endOffset: existingHighlight.endOffset,
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
      highlights: highlights.map(h => ({ id: h.id, selectedText: h.selectedText })),
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
              const containmentPosition = getContainmentPosition(firstHighlight, selectedText.text);

              // Multiple overlapping highlights - offer to merge all
              if (overlappingHighlights.length > 1) {
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
