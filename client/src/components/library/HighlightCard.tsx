import { Link } from 'react-router-dom';
import { Trash2, ExternalLink } from 'lucide-react';
import { useHighlightDisplay } from '../../contexts/HighlightDisplayContext';
import { getHighlightContext } from '../../utils/highlightContext';
import type { Highlight } from '../../types';

interface HighlightCardProps {
  highlight: Highlight;
  onRemove: (id: number) => void;
  showPostInfo?: boolean;
  isLast?: boolean;
}

export default function HighlightCard({ highlight, onRemove, showPostInfo = true, isLast = false }: HighlightCardProps) {
  const { showContext: showContextEnabled } = useHighlightDisplay();

  const context = getHighlightContext(highlight.post?.content, highlight.selectedText);
  const author = highlight.post?.author;

  return (
    <div className={showPostInfo ? 'card p-6' : `p-4 ${!isLast ? 'border-b border-ink-700' : ''}`}>
      {/* Header with author and post info - only shown when not grouped */}
      {showPostInfo && (
        <div className="flex items-center space-x-3 mb-4">
          {author?.avatarUrl ? (
            <img
              src={author.avatarUrl}
              alt={author.displayName}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-ink-700 flex items-center justify-center">
              <span className="text-ink-300 font-medium">
                {author?.displayName?.charAt(0) || '?'}
              </span>
            </div>
          )}
          <div>
            {author && (
              <Link
                to={`/@${author.username}`}
                className="text-sm font-medium text-ink-200 hover:text-gold-600 transition-colors"
              >
                {author.displayName}
              </Link>
            )}
            <Link
              to={`/post/${highlight.postId}`}
              className="block text-ink-400 hover:text-gold-500 transition-colors"
            >
              {highlight.post?.title || 'Untitled post'}
            </Link>
          </div>
        </div>
      )}

      {/* Highlight with context */}
      <blockquote className="border-l-4 border-gold-600 px-4 rounded-r-lg">
        <p className="text-ink-300 leading-relaxed">
          {showContextEnabled && context.before && (
            <span className="text-ink-500">{context.before} </span>
          )}
          <span className="text-ink-100 font-medium bg-gold-600/20 px-1 rounded">
            {highlight.selectedText}
          </span>
          {showContextEnabled && context.after && (
            <span className="text-ink-500"> {context.after}</span>
          )}
        </p>
      </blockquote>

      {/* Note if present */}
      {highlight.note && (
        <p className="text-ink-400 text-sm mt-3 italic">"{highlight.note}"</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3">
          <p className="text-xs text-ink-500">
            {new Date(highlight.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
          {highlight.chapter && (
            <span className="text-xs text-ink-500 bg-ink-800 px-2 py-1 rounded">
              Chapter: {highlight.chapter.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/post/${highlight.postId}?highlight=${encodeURIComponent(highlight.selectedText.slice(0, 100))}`}
            className="p-1.5 rounded-lg hover:bg-ink-700 text-ink-500 hover:text-gold-500 transition-colors"
            title="View in post"
          >
            <ExternalLink size={14} />
          </Link>
          <button
            onClick={() => onRemove(highlight.id)}
            className="p-1.5 rounded-lg hover:bg-red-900/50 text-ink-500 hover:text-red-400 transition-colors"
            title="Remove highlight"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
