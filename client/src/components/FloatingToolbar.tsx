import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SignedIn, useAuth } from '@clerk/clerk-react';
import {
  PenTool,
  Highlighter,
  Share2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Type,
  FileText,
  BookOpen,
  ArrowUp,
  Loader2,
  X,
  TextQuote,
  Check,
  Eye,
  EyeOff,
  Heart,
  Bookmark,
} from 'lucide-react';
import { useHighlightMode } from '../contexts/HighlightModeContext';
import { useHighlightDisplay } from '../contexts/HighlightDisplayContext';
import { postApi, highlightApi, appreciationApi, bookmarkApi } from '../services/api';
import type { Highlight, Post } from '../types';

// Tooltip wrapper component
interface TooltipButtonProps {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
  as?: 'button' | 'link';
  to?: string;
  forceShowTooltip?: boolean;
}

function TooltipButton({ children, label, onClick, className = '', as = 'button', to, forceShowTooltip = false }: TooltipButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const isVisible = forceShowTooltip || showTooltip;

  const baseClass = `relative ${className}`;

  const tooltip = (
    <div
      className={`absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-ink-800 border border-ink-700 rounded-lg text-sm text-ink-200 whitespace-nowrap shadow-lg transition-all duration-200 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'
        }`}
    >
      {label}
      {/* Arrow */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full">
        <div className="border-8 border-transparent border-l-ink-700" />
      </div>
    </div>
  );

  if (as === 'link' && to) {
    return (
      <div className="relative">
        <Link
          to={to}
          className={baseClass}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {children}
        </Link>
        {tooltip}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={baseClass}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {children}
      </button>
      {tooltip}
    </div>
  );
}

export default function FloatingToolbar() {
  const location = useLocation();
  const { isSignedIn } = useAuth();
  const { isHighlightMode, toggleHighlightMode } = useHighlightMode();
  const { showContext, toggleShowContext, showHighlightsInContent, toggleShowHighlightsInContent } = useHighlightDisplay();
  const [showWriteMenu, setShowWriteMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showAITools, setShowAITools] = useState(false);
  const [showHighlightTools, setShowHighlightTools] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ text: string; reason: string }>>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [existingHighlights, setExistingHighlights] = useState<Highlight[]>([]);
  const [post, setPost] = useState<Post | null>(null);

  // Refs for click-outside detection
  const writeMenuRef = useRef<HTMLDivElement>(null);
  const highlightToolsRef = useRef<HTMLDivElement>(null);
  const aiToolsRef = useRef<HTMLDivElement>(null);

  const isFeedPage = location.pathname === '/feed';
  const isLibraryHighlightsTab = location.pathname === '/library/highlights';

  // Check if we're on a post page and extract the post ID
  const postMatch = location.pathname.match(/^\/post\/(\d+)/);
  const postId = postMatch ? parseInt(postMatch[1]) : null;

  // Clear cached data when navigating to a different post
  useEffect(() => {
    setSummary(null);
    setSummaryError(null);
    setShowSummary(false);
    setSuggestions([]);
    setSuggestionsError(null);
    setShowSuggestions(false);
    setAppliedSuggestions(new Set());
    setExistingHighlights([]);
    setShowAITools(false);
    setShowHighlightTools(false);
    setPost(null);
  }, [postId]);

  // Fetch post data for appreciation/bookmark status
  useEffect(() => {
    if (!postId || !isSignedIn) {
      setPost(null);
      return;
    }

    const fetchPost = async () => {
      try {
        const postData = await postApi.getById(postId);
        setPost(postData);
      } catch (error) {
        console.error('Failed to fetch post:', error);
      }
    };

    fetchPost();
  }, [postId, isSignedIn]);

  // Close submenus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (showWriteMenu && writeMenuRef.current && !writeMenuRef.current.contains(target)) {
        setShowWriteMenu(false);
      }

      if (showHighlightTools && highlightToolsRef.current && !highlightToolsRef.current.contains(target)) {
        setShowHighlightTools(false);
      }

      if ((showAITools || showSummary || showSuggestions) && aiToolsRef.current && !aiToolsRef.current.contains(target)) {
        setShowAITools(false);
        setShowSummary(false);
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showWriteMenu, showHighlightTools, showAITools, showSummary, showSuggestions]);

  const scrollToNext = () => {
    const snapContainer = document.querySelector('[data-scroll="snap"]');
    if (snapContainer) {
      snapContainer.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
    } else {
      window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
    }
  };

  const scrollToPrevious = () => {
    const snapContainer = document.querySelector('[data-scroll="snap"]');
    if (snapContainer) {
      snapContainer.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
    } else {
      window.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    // Try to scroll the snap scroll container first (for feed page)
    const snapContainer = document.querySelector('[data-scroll="snap"]');
    if (snapContainer) {
      snapContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Also scroll window and document for other pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

  const handleSummary = async () => {
    if (!postId) return;

    // Toggle off if already showing
    if (showSummary) {
      setShowSummary(false);
      return;
    }

    // If we already have a cached summary, just show it
    if (summary) {
      setShowSummary(true);
      return;
    }

    // Fetch new summary
    await fetchSummary();
  };

  const fetchSummary = async () => {
    if (!postId) return;

    setSummaryLoading(true);
    setSummaryError(null);
    setShowSummary(true);

    try {
      const result = await postApi.getSummary(postId);
      setSummary(result.summary);
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : 'Failed to generate summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleRegenerateSummary = async () => {
    setSummary(null);
    await fetchSummary();
  };

  const handleSuggestHighlights = async () => {
    if (!postId) return;

    // Toggle off if already showing
    if (showSuggestions) {
      setShowSuggestions(false);
      return;
    }

    // If we already have suggestions, just show them (but refresh highlights)
    if (suggestions.length > 0) {
      setShowSuggestions(true);
      // Refresh existing highlights to catch any new ones
      try {
        const highlights = await highlightApi.getPostHighlights(postId);
        setExistingHighlights(highlights);
      } catch {
        // Ignore errors fetching highlights
      }
      return;
    }

    // Fetch new suggestions and existing highlights
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    setShowSuggestions(true);

    try {
      const [suggestionsResult, highlightsResult] = await Promise.all([
        postApi.suggestHighlights(postId),
        highlightApi.getPostHighlights(postId).catch(() => []),
      ]);
      setSuggestions(suggestionsResult.suggestions);
      setExistingHighlights(highlightsResult);
    } catch (error) {
      setSuggestionsError(error instanceof Error ? error.message : 'Failed to get suggestions');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleApplySuggestion = async (text: string) => {
    if (!postId) return;

    try {
      // Find the text in the page content to get offsets
      const contentElement = document.querySelector('.post-content, .prose, article');
      if (!contentElement) return;

      const textContent = contentElement.textContent || '';
      const startOffset = textContent.indexOf(text);
      if (startOffset === -1) return;

      const newHighlight = await highlightApi.create({
        postId,
        selectedText: text,
        startOffset,
        endOffset: startOffset + text.length,
      });

      setAppliedSuggestions(prev => new Set([...prev, text]));
      setExistingHighlights(prev => [...prev, newHighlight]);

      // Notify PostView to refresh its highlights
      window.dispatchEvent(new CustomEvent('highlight-created', { detail: newHighlight }));
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: document.title,
          url: window.location.href,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      setShowShareMenu(true);
      setTimeout(() => setShowShareMenu(false), 2000);
    }
  };

  return (
    <div className="fixed right-8 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-3">
      {/* Write Button with Menu */}
      <SignedIn>
        <div ref={writeMenuRef} className="relative">
          <TooltipButton
            label="Create"
            onClick={() => setShowWriteMenu(!showWriteMenu)}
            className="w-10 h-10 rounded-full bg-ink-800 text-ink-400 flex items-center justify-center shadow-lg hover:border-green-600 hover:text-green-500 transition-all hover:scale-110"
          >
            <PenTool size={18} />
          </TooltipButton>

          {/* Write Menu Dropdown */}
          {showWriteMenu && (
            <div className="absolute right-full mr-3 top-0 bg-ink-800 border border-ink-700 rounded-xl shadow-xl py-2 min-w-[160px]">
              <Link
                to="/write/line"
                onClick={() => setShowWriteMenu(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-ink-200 hover:bg-ink-700 hover:text-gold-500 transition-colors"
              >
                <Type size={18} />
                <div>
                  <div className="font-medium">Line</div>
                  <div className="text-xs text-ink-400">A single thought</div>
                </div>
              </Link>
              <Link
                to="/write/page"
                onClick={() => setShowWriteMenu(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-ink-200 hover:bg-ink-700 hover:text-gold-500 transition-colors"
              >
                <FileText size={18} />
                <div>
                  <div className="font-medium">Page</div>
                  <div className="text-xs text-ink-400">An essay or article</div>
                </div>
              </Link>
              <Link
                to="/write/book"
                onClick={() => setShowWriteMenu(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-ink-200 hover:bg-ink-700 hover:text-gold-500 transition-colors"
              >
                <BookOpen size={18} />
                <div>
                  <div className="font-medium">Book</div>
                  <div className="text-xs text-ink-400">Multi-chapter work</div>
                </div>
              </Link>
            </div>
          )}
        </div>
      </SignedIn>

      {/* Divider */}
      <div className="w-px h-4 bg-ink-700" />

      {/* Highlight Tools (only on post pages) */}
      {postId && (
        <SignedIn>
          <div ref={highlightToolsRef} className="relative">
            <TooltipButton
              label={showHighlightTools ? '' : 'Highlights'}
              onClick={() => setShowHighlightTools(!showHighlightTools)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 ${showHighlightTools || isHighlightMode
                  ? 'bg-gold-600 text-ink-950'
                  : 'bg-ink-800 border border-ink-700 text-ink-400 hover:text-gold-500 hover:border-gold-600'
                }`}
            >
              <Highlighter size={18} />
            </TooltipButton>

            {/* Highlight Tools Submenu */}
            {showHighlightTools && (
              <div className="absolute right-full mr-3 top-0 bg-ink-800 border border-ink-700 rounded-xl shadow-xl py-2 min-w-[180px]">
                <button
                  onClick={() => {
                    if (showHighlightsInContent) {
                      toggleHighlightMode();
                    }
                  }}
                  disabled={!showHighlightsInContent}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${
                    !showHighlightsInContent
                      ? 'text-ink-500 cursor-not-allowed'
                      : 'text-ink-200 hover:bg-ink-700 hover:text-gold-500'
                  }`}
                >
                  <Highlighter size={18} className={isHighlightMode ? 'text-gold-500' : ''} />
                  <div className="text-left">
                    <div className="font-medium">Highlighter</div>
                    <div className="text-xs text-ink-400">{isHighlightMode ? 'Mode is on' : 'Click to enable'}</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    if (showHighlightsInContent && isHighlightMode) {
                      toggleHighlightMode();
                    }
                    toggleShowHighlightsInContent();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-ink-200 hover:bg-ink-700 hover:text-gold-500 transition-colors"
                >
                  {showHighlightsInContent ? <Eye size={18} className="text-gold-500" /> : <EyeOff size={18} />}
                  <div className="text-left">
                    <div className="font-medium">Visibility</div>
                    <div className="text-xs text-ink-400">{showHighlightsInContent ? 'Showing in text' : 'Hidden in text'}</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </SignedIn>
      )}
      {postId && (
        <SignedIn>
          <div ref={aiToolsRef} className="relative">
            <TooltipButton
              label={showAITools || showSummary || showSuggestions ? '' : 'AI Tools'}
              onClick={() => {
                setShowAITools(!showAITools);
                if (showAITools) {
                  setShowSummary(false);
                  setShowSuggestions(false);
                }
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 ${showAITools || showSummary || showSuggestions
                  ? 'bg-purple-600 text-white border border-purple-500'
                  : 'bg-ink-800 border border-ink-700 text-ink-400 hover:text-purple-400 hover:border-purple-500'
                }`}
            >
              <Sparkles size={18} />
            </TooltipButton>

            {/* AI Tools Submenu */}
            {showAITools && !showSummary && !showSuggestions && (
              <div className="absolute right-full mr-3 top-0 bg-ink-800 border border-ink-700 rounded-xl shadow-xl py-2 min-w-[180px]">
                <button
                  onClick={() => {
                    setShowAITools(false);
                    handleSuggestHighlights();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-ink-200 hover:bg-ink-700 hover:text-gold-500 transition-colors"
                >
                  <Highlighter size={18} />
                  <div className="text-left">
                    <div className="font-medium">Suggest Highlights</div>
                    <div className="text-xs text-ink-400">Find noteworthy passages</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowAITools(false);
                    handleSummary();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-ink-200 hover:bg-ink-700 hover:text-purple-400 transition-colors"
                >
                  <Sparkles size={18} />
                  <div className="text-left">
                    <div className="font-medium">AI Summary</div>
                    <div className="text-xs text-ink-400">Summarize this post</div>
                  </div>
                </button>
              </div>
            )}

            {/* AI Summary Panel */}
            {showSummary && (
              <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 w-72 bg-ink-800 border border-purple-500/50 rounded-lg p-4 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-400 text-sm font-medium flex items-center gap-1">
                    <Sparkles size={14} />
                    AI Summary
                  </span>
                  <button
                    onClick={() => setShowSummary(false)}
                    className="text-ink-400 hover:text-ink-200 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
                {summaryLoading ? (
                  <p className="text-ink-400 text-sm">Generating summary...</p>
                ) : summaryError ? (
                  <p className="text-red-400 text-sm">{summaryError}</p>
                ) : (
                  <>
                    <p className="text-ink-200 text-sm leading-relaxed">{summary}</p>
                    <button
                      onClick={handleRegenerateSummary}
                      className="mt-3 text-xs text-ink-400 hover:text-purple-400 transition-colors"
                    >
                      Regenerate
                    </button>
                  </>
                )}
              </div>
            )}

            {/* AI Suggestions Panel */}
            {showSuggestions && (
              <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 w-80 bg-ink-800 border border-gold-500/50 rounded-lg p-4 shadow-xl max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gold-500 text-sm font-medium flex items-center gap-1">
                    <Highlighter size={14} />
                    Suggested Highlights
                  </span>
                  <button
                    onClick={() => setShowSuggestions(false)}
                    className="text-ink-400 hover:text-ink-200 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
                {suggestionsLoading ? (
                  <div className="flex items-center gap-2 text-ink-400 text-sm">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Finding noteworthy passages...</span>
                  </div>
                ) : suggestionsError ? (
                  <p className="text-red-400 text-sm">{suggestionsError}</p>
                ) : suggestions.length === 0 ? (
                  <p className="text-ink-400 text-sm">No suggestions found for this post.</p>
                ) : (
                  <div className="space-y-3">
                    {suggestions.map((suggestion, index) => {
                      const isApplied = appliedSuggestions.has(suggestion.text);
                      // Check if this suggestion overlaps with existing highlights
                      const isAlreadyHighlighted = existingHighlights.some(h => {
                        // Check for text overlap (exact match, contains, or is contained)
                        return (
                          h.selectedText === suggestion.text ||
                          h.selectedText.includes(suggestion.text) ||
                          suggestion.text.includes(h.selectedText)
                        );
                      });
                      const isHighlighted = isApplied || isAlreadyHighlighted;
                      return (
                        <div key={index} className={`border rounded-lg p-3 ${isHighlighted ? 'border-green-600/50 bg-green-900/10' : 'border-ink-700'
                          }`}>
                          <p className="text-ink-200 text-sm leading-relaxed mb-2 line-clamp-3">
                            "{suggestion.text}"
                          </p>
                          <p className="text-ink-400 text-xs mb-2">{suggestion.reason}</p>
                          <button
                            onClick={() => handleApplySuggestion(suggestion.text)}
                            disabled={isHighlighted}
                            className={`text-xs flex items-center gap-1 transition-colors ${isHighlighted
                                ? 'text-green-500 cursor-default'
                                : 'text-gold-500 hover:text-gold-400'
                              }`}
                          >
                            {isHighlighted ? (
                              <>
                                <Check size={12} />
                                {isAlreadyHighlighted ? 'Already highlighted' : 'Highlighted'}
                              </>
                            ) : (
                              <>
                                <Highlighter size={12} />
                                Apply Highlight
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </SignedIn>
      )}


      <div className="w-px h-4 bg-ink-700" />
      {/* Appreciation (only on post pages) */}
      {postId && post && (
        <SignedIn>
          <TooltipButton
            label={post.isAppreciated ? 'Appreciated' : 'Appreciate'}
            onClick={handleAppreciate}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 ${post.isAppreciated
                ? 'bg-red-500 text-white border border-red-500'
                : 'bg-ink-800 border border-ink-700 text-ink-400 hover:text-red-400 hover:border-red-500'
              }`}
          >
            <Heart size={18} fill={post.isAppreciated ? 'currentColor' : 'none'} />
          </TooltipButton>
        </SignedIn>
      )}

      {/* Bookmark (only on post pages) */}
      {postId && post && (
        <SignedIn>
          <TooltipButton
            label={post.isBookmarked ? 'Saved' : 'Save'}
            onClick={handleBookmark}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 ${post.isBookmarked
                ? 'bg-blue-600 text-ink-950'
                : 'bg-ink-800 border border-ink-700 text-ink-400 hover:text-blue-500 hover:border-blue-600'
              }`}
          >
            <Bookmark size={18} fill={post.isBookmarked ? 'currentColor' : 'none'} />
          </TooltipButton>
        </SignedIn>
      )}

      {/* Share */}
      <div className="relative">
        <TooltipButton
          label="Share"
          onClick={handleShare}
          className="w-10 h-10 rounded-full bg-ink-800 border border-ink-700 text-ink-400 flex items-center justify-center hover:text-gold-500 hover:border-gold-600 transition-all hover:scale-110"
        >
          <Share2 size={18} />
        </TooltipButton>
        {showShareMenu && (
          <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-ink-800 border border-gold-600 rounded-lg px-3 py-2 text-sm text-gold-500 whitespace-nowrap shadow-lg">
            Link copied!
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-ink-700" />

      {/* Navigation (only on feed) */}
      {isFeedPage && (
        <>
          <TooltipButton
            label="Previous post"
            onClick={scrollToPrevious}
            className="w-10 h-10 rounded-full bg-ink-800 border border-ink-700 text-ink-400 flex items-center justify-center hover:text-ink-100 hover:border-ink-500 transition-all hover:scale-110"
          >
            <ChevronUp size={20} />
          </TooltipButton>

          <TooltipButton
            label="Next post"
            onClick={scrollToNext}
            className="w-10 h-10 rounded-full bg-ink-800 border border-ink-700 text-ink-400 flex items-center justify-center hover:text-ink-100 hover:border-ink-500 transition-all hover:scale-110"
          >
            <ChevronDown size={20} />
          </TooltipButton>

          <div className="w-px h-4 bg-ink-700" />
        </>
      )}

      {/* AI Tools */}


      {/* Highlight Context Toggle (only on library highlights tab) */}
      {isLibraryHighlightsTab && (
        <SignedIn>
          <TooltipButton
            label={showContext ? 'Hide Context' : 'Show Context'}
            onClick={toggleShowContext}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 ${showContext
                ? 'bg-gold-600 text-ink-950'
                : 'bg-ink-800 border border-ink-700 text-ink-400 hover:text-gold-500 hover:border-gold-600'
              }`}
          >
            <TextQuote size={18} />
          </TooltipButton>
        </SignedIn>
      )}

      {/* Divider */}
      <div className="w-px h-4 bg-ink-700" />

      {/* Scroll to Top */}
      <TooltipButton
        label="Top"
        onClick={scrollToTop}
        className="w-10 h-10 rounded-full bg-ink-800 border border-ink-700 text-ink-400 flex items-center justify-center hover:text-ink-100 hover:border-ink-500 transition-all hover:scale-110"
      >
        <ArrowUp size={18} />
      </TooltipButton>
    </div>
  );
}
