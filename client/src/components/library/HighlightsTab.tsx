import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Highlighter, ChevronDown, ChevronRight } from 'lucide-react';
import HighlightCard from './HighlightCard';
import LibraryEmptyState from './LibraryEmptyState';
import LibraryLoadingSkeleton from './LibraryLoadingSkeleton';
import { useHighlights } from '../../hooks/useHighlights';
import type { Highlight } from '../../types';

export default function HighlightsTab() {
  const { highlights, loading, removeHighlight } = useHighlights();

  if (loading) {
    return <LibraryLoadingSkeleton />;
  }

  if (highlights.length === 0) {
    return (
      <LibraryEmptyState
        icon={Highlighter}
        title="No highlights yet"
        description="When you highlight text in posts, they'll appear here."
      />
    );
  }

  return <GroupedHighlights highlights={highlights} onRemove={removeHighlight} />;
}

interface GroupedHighlightsProps {
  highlights: Highlight[];
  onRemove: (id: number) => void;
}

function GroupedHighlights({ highlights, onRemove }: GroupedHighlightsProps) {
  const [expandedPosts, setExpandedPosts] = useState<Set<number>>(new Set());

  // Group highlights by post
  const groupedHighlights = useMemo(() => {
    const groups = new Map<number, { post: Highlight['post']; highlights: Highlight[] }>();

    for (const highlight of highlights) {
      const postId = highlight.postId;
      if (!groups.has(postId)) {
        groups.set(postId, { post: highlight.post, highlights: [] });
      }
      groups.get(postId)!.highlights.push(highlight);
    }

    // Convert to array and sort by most recent highlight
    return Array.from(groups.values()).sort((a, b) => {
      const aLatest = Math.max(...a.highlights.map(h => new Date(h.createdAt).getTime()));
      const bLatest = Math.max(...b.highlights.map(h => new Date(h.createdAt).getTime()));
      return bLatest - aLatest;
    });
  }, [highlights]);

  const togglePost = (postId: number) => {
    setExpandedPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {groupedHighlights.map((group) => {
        const postId = group.post?.id || 0;
        const isExpanded = expandedPosts.has(postId);
        const author = group.post?.author;

        return (
          <div key={postId} className="card overflow-hidden">
            {/* Post Header - Clickable to expand/collapse */}
            <button
              onClick={() => togglePost(postId)}
              className="w-full p-4 flex items-center justify-between hover:bg-ink-800/50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="text-left">
                  <p className="text-ink-200 font-medium">
                    {group.highlights.length} highlight{group.highlights.length !== 1 ? 's' : ''} from "{group.post?.title || 'Untitled post'}" by {author?.displayName || 'Unknown author'}
                  </p>
                  <p className="text-sm text-ink-400">
                    <Link
                  to={`/post/${postId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-ink-400 hover:text-gold-500 px-2 py-1 rounded hover:bg-ink-700 transition-colors"
                >
                  View post
                </Link></p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                
                {isExpanded ? (
                  <ChevronDown size={20} className="text-ink-400" />
                ) : (
                  <ChevronRight size={20} className="text-ink-400" />
                )}
              </div>
            </button>

            {/* Highlights List */}
            {isExpanded && (
              <div className="border-t border-ink-700">
                {group.highlights.map((highlight, index) => (
                  <HighlightCard
                    key={highlight.id}
                    highlight={highlight}
                    onRemove={onRemove}
                    showPostInfo={false}
                    isLast={index === group.highlights.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
