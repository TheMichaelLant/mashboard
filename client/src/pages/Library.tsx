import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Archive, Highlighter, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import PostCard from '../components/PostCard';
import { bookmarkApi, highlightApi, appreciationApi } from '../services/api';
import type { Post, Highlight } from '../types';

type Tab = 'bookmarks' | 'archives' | 'highlights';

export default function Library() {
  const [activeTab, setActiveTab] = useState<Tab>('bookmarks');
  const [bookmarks, setBookmarks] = useState<Post[]>([]);
  const [archives, setArchives] = useState<Post[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'bookmarks') {
          const data = await bookmarkApi.getMyBookmarks();
          setBookmarks(data);
        } else if (activeTab === 'archives') {
          const data = await bookmarkApi.getMyArchives();
          setArchives(data);
        } else {
          const data = await highlightApi.getMyHighlights();
          setHighlights(data);
        }
      } catch (error) {
        console.error('Failed to fetch library data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeTab]);

  const handleRemoveBookmark = async (postId: number) => {
    try {
      await bookmarkApi.unbookmark(postId);
      setBookmarks((prev) => prev.filter((p) => p.id !== postId));
    } catch (error) {
      console.error('Failed to remove bookmark:', error);
    }
  };

  const handleRemoveArchive = async (bookId: number) => {
    try {
      await bookmarkApi.unarchive(bookId);
      setArchives((prev) => prev.filter((p) => p.id !== bookId));
    } catch (error) {
      console.error('Failed to remove archive:', error);
    }
  };

  const handleRemoveHighlight = async (highlightId: number) => {
    try {
      await highlightApi.delete(highlightId);
      setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
    } catch (error) {
      console.error('Failed to remove highlight:', error);
    }
  };

  const handleAppreciate = async (postId: number) => {
    const updatePosts = (list: Post[]) =>
      list.map((p) =>
        p.id === postId
          ? {
              ...p,
              isAppreciated: !p.isAppreciated,
              appreciationCount: p.isAppreciated
                ? (p.appreciationCount || 1) - 1
                : (p.appreciationCount || 0) + 1,
            }
          : p
      );

    try {
      const post = bookmarks.find((p) => p.id === postId) || archives.find((p) => p.id === postId);
      if (post?.isAppreciated) {
        await appreciationApi.unappreciate(postId);
      } else {
        await appreciationApi.appreciate(postId);
      }
      setBookmarks(updatePosts);
      setArchives(updatePosts);
    } catch (error) {
      console.error('Failed to toggle appreciation:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-display font-bold text-ink-100">Library</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 border-b border-ink-700 mb-8">
        <TabButton
          active={activeTab === 'bookmarks'}
          onClick={() => setActiveTab('bookmarks')}
          icon={Bookmark}
          label="Bookmarks"
          count={bookmarks.length}
        />
        <TabButton
          active={activeTab === 'archives'}
          onClick={() => setActiveTab('archives')}
          icon={Archive}
          label="Archives"
          count={archives.length}
        />
        <TabButton
          active={activeTab === 'highlights'}
          onClick={() => setActiveTab('highlights')}
          icon={Highlighter}
          label="Highlights"
          count={highlights.length}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-ink-700 rounded w-3/4 mb-2" />
              <div className="h-4 bg-ink-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : activeTab === 'highlights' ? (
        highlights.length > 0 ? (
          <GroupedHighlights
            highlights={highlights}
            onRemove={handleRemoveHighlight}
          />
        ) : (
          <EmptyState
            icon={Highlighter}
            title="No highlights yet"
            description="When you highlight text in posts, they'll appear here."
          />
        )
      ) : activeTab === 'archives' ? (
        archives.length > 0 ? (
          <div className="space-y-4">
            {archives.map((book) => (
              <div key={book.id} className="relative">
                <PostCard
                  post={book}
                  variant="list"
                  onAppreciate={handleAppreciate}
                  onBookmark={() => handleRemoveArchive(book.id)}
                />
                <button
                  onClick={() => handleRemoveArchive(book.id)}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-ink-800 hover:bg-red-900/50 text-ink-400 hover:text-red-400 transition-colors"
                  title="Remove from archives"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Archive}
            title="No archived books"
            description="When you archive books, they'll appear here for easy access."
          />
        )
      ) : bookmarks.length > 0 ? (
        <div className="space-y-4">
          {bookmarks.map((post) => (
            <div key={post.id} className="relative">
              <PostCard
                post={post}
                variant="list"
                onAppreciate={handleAppreciate}
                onBookmark={() => handleRemoveBookmark(post.id)}
              />
              <button
                onClick={() => handleRemoveBookmark(post.id)}
                className="absolute top-4 right-4 p-2 rounded-lg bg-ink-800 hover:bg-red-900/50 text-ink-400 hover:text-red-400 transition-colors"
                title="Remove bookmark"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Bookmark}
          title="No bookmarks yet"
          description="When you bookmark posts, they'll appear here."
        />
      )}
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count?: number;
}

function TabButton({ active, onClick, icon: Icon, label, count }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
        active
          ? 'border-gold-600 text-gold-600'
          : 'border-transparent text-ink-400 hover:text-ink-200'
      }`}
    >
      <Icon size={18} />
      <span className="font-medium">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs bg-ink-700 px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </button>
  );
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
                <div className="text-left">
                  <p className="text-ink-200 font-medium">
                    {group.post?.title || 'Untitled post'}
                  </p>
                  <p className="text-sm text-ink-400">
                    {author?.displayName} · {group.highlights.length} highlight{group.highlights.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Link
                  to={`/post/${postId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-ink-400 hover:text-gold-500 px-2 py-1 rounded hover:bg-ink-700 transition-colors"
                >
                  View post
                </Link>
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

interface HighlightCardProps {
  highlight: Highlight;
  onRemove: (id: number) => void;
  showPostInfo?: boolean;
  isLast?: boolean;
}

function HighlightCard({ highlight, onRemove, showPostInfo = true, isLast = false }: HighlightCardProps) {
  // Extract context around the highlight from post content
  const getContext = () => {
    if (!highlight.post?.content) return { before: '', after: '' };

    // Strip HTML tags for plain text matching
    const plainContent = highlight.post.content.replace(/<[^>]*>/g, '');
    const highlightIndex = plainContent.indexOf(highlight.selectedText);

    if (highlightIndex === -1) return { before: '', after: '' };

    // Get up to 50 characters before and after
    const contextLength = 50;

    // Get text before the highlight
    let beforeStart = Math.max(0, highlightIndex - contextLength);
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
    const afterStart = highlightIndex + highlight.selectedText.length;
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
  };

  const context = getContext();
  const author = highlight.post?.author;

  return (
    <div className={showPostInfo ? 'card p-6' : `p-4 ${!isLast ? 'border-b border-ink-700' : ''}`}>
      {/* Header with author and post info - only shown when not grouped */}
      {showPostInfo && (
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
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
          <button
            onClick={() => onRemove(highlight.id)}
            className="p-1.5 rounded-lg hover:bg-red-900/50 text-ink-500 hover:text-red-400 transition-colors"
            title="Remove highlight"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}

      {/* Grouped view header with delete button */}
      {!showPostInfo && (
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1" />
          <button
            onClick={() => onRemove(highlight.id)}
            className="p-1.5 rounded-lg hover:bg-red-900/50 text-ink-500 hover:text-red-400 transition-colors"
            title="Remove highlight"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {/* Highlight with context */}
      <blockquote className="bg-gold-900/20 border-l-4 border-gold-600 p-4 rounded-r-lg">
        <p className="text-ink-300 leading-relaxed">
          {context.before && (
            <span className="text-ink-500">{context.before} </span>
          )}
          <span className="text-ink-100 font-medium bg-gold-600/20 px-1 rounded">
            {highlight.selectedText}
          </span>
          {context.after && (
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
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="card p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-ink-800 flex items-center justify-center mx-auto mb-4">
        <Icon className="text-ink-500" size={32} />
      </div>
      <h2 className="text-xl font-display font-bold text-ink-100 mb-2">
        {title}
      </h2>
      <p className="text-ink-400 mb-6">{description}</p>
      <Link to="/discover" className="btn btn-primary">
        Discover Content
      </Link>
    </div>
  );
}
