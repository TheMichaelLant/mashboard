import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SignedIn } from '@clerk/clerk-react';
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
} from 'lucide-react';
import { useHighlightMode } from '../contexts/HighlightModeContext';
import { useHighlightDisplay } from '../contexts/HighlightDisplayContext';
import { postApi } from '../services/api';

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
      className={`absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-ink-800 border border-ink-700 rounded-lg text-sm text-ink-200 whitespace-nowrap shadow-lg transition-all duration-200 ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'
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
  const { isHighlightMode, toggleHighlightMode } = useHighlightMode();
  const { showContext, toggleShowContext } = useHighlightDisplay();
  const [showWriteMenu, setShowWriteMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const isFeedPage = location.pathname === '/feed';
  const isLibraryHighlightsTab = location.pathname === '/library/highlights';

  // Check if we're on a post page and extract the post ID
  const postMatch = location.pathname.match(/^\/post\/(\d+)/);
  const postId = postMatch ? parseInt(postMatch[1]) : null;

  // Clear cached summary when navigating to a different post
  useEffect(() => {
    setSummary(null);
    setSummaryError(null);
    setShowSummary(false);
  }, [postId]);

  const scrollToNext = () => {
    const snapContainer = document.querySelector('.snap-container');
    if (snapContainer) {
      snapContainer.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
    } else {
      window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
    }
  };

  const scrollToPrevious = () => {
    const snapContainer = document.querySelector('.snap-container');
    if (snapContainer) {
      snapContainer.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
    } else {
      window.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    // Try to scroll the snap-container first (for feed page)
    const snapContainer = document.querySelector('.snap-container');
    if (snapContainer) {
      snapContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Also scroll window and document for other pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
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
        <div className="relative">
          <TooltipButton
            label="Create"
            onClick={() => setShowWriteMenu(!showWriteMenu)}
            className="w-12 h-12 rounded-full bg-gold-600 text-ink-950 flex items-center justify-center shadow-lg hover:bg-gold-500 transition-all hover:scale-110"
          >
            <PenTool size={20} />
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

      {/* Highlight Mode Toggle */}
      <SignedIn>
        <TooltipButton
          label={isHighlightMode ? 'Enabled' : 'Highlight'}
          onClick={toggleHighlightMode}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 ${
            isHighlightMode
              ? 'bg-gold-600 text-ink-950'
              : 'bg-ink-800 border border-ink-700 text-ink-400 hover:text-gold-500 hover:border-gold-600'
          }`}
          forceShowTooltip={isHighlightMode}
        >
          <Highlighter size={18} />
        </TooltipButton>
      </SignedIn>

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

      {/* AI Summary */}
      {postId && (
        <SignedIn>
          <div className="relative">
            <TooltipButton
              label={showSummary ? '' : 'AI Summary'}
              onClick={handleSummary}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 ${
                showSummary
                  ? 'bg-purple-600 text-white border border-purple-500'
                  : 'bg-ink-800 border border-ink-700 text-ink-400 hover:text-purple-400 hover:border-purple-500'
              }`}
            >
              {summaryLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Sparkles size={18} />
              )}
            </TooltipButton>
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
          </div>
        </SignedIn>
      )}

      {/* Highlight Context Toggle (only on library highlights tab) */}
      {isLibraryHighlightsTab && (
        <SignedIn>
          <TooltipButton
            label={showContext ? 'Hide Context' : 'Show Context'}
            onClick={toggleShowContext}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 ${
              showContext
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
