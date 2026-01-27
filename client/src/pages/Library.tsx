import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Archive, Highlighter, Trash2 } from 'lucide-react';
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
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-display font-bold text-ink-900">Library</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 border-b border-paper-100 mb-6">
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
              <div className="h-4 bg-paper-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-paper-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : activeTab === 'highlights' ? (
        highlights.length > 0 ? (
          <div className="space-y-4">
            {highlights.map((highlight) => (
              <HighlightCard
                key={highlight.id}
                highlight={highlight}
                onRemove={handleRemoveHighlight}
              />
            ))}
          </div>
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
                  onAppreciate={handleAppreciate}
                  onBookmark={() => handleRemoveArchive(book.id)}
                />
                <button
                  onClick={() => handleRemoveArchive(book.id)}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-white shadow hover:bg-red-50 text-ink-400 hover:text-red-500"
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
                onAppreciate={handleAppreciate}
                onBookmark={() => handleRemoveBookmark(post.id)}
              />
              <button
                onClick={() => handleRemoveBookmark(post.id)}
                className="absolute top-4 right-4 p-2 rounded-lg bg-white shadow hover:bg-red-50 text-ink-400 hover:text-red-500"
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
          ? 'border-ink-900 text-ink-900'
          : 'border-transparent text-ink-500 hover:text-ink-700'
      }`}
    >
      <Icon size={18} />
      <span className="font-medium">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs bg-paper-200 px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </button>
  );
}

interface HighlightCardProps {
  highlight: Highlight;
  onRemove: (id: number) => void;
}

function HighlightCard({ highlight, onRemove }: HighlightCardProps) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-3">
        <Link
          to={`/post/${highlight.postId}`}
          className="text-sm text-ink-500 hover:text-ink-700"
        >
          {highlight.post?.title || 'Untitled post'}
        </Link>
        <button
          onClick={() => onRemove(highlight.id)}
          className="p-1 rounded hover:bg-red-50 text-ink-400 hover:text-red-500"
          title="Remove highlight"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <blockquote className="bg-yellow-50 border-l-4 border-yellow-300 p-4 rounded-r-lg">
        <p className="text-ink-800 italic">"{highlight.selectedText}"</p>
      </blockquote>
      {highlight.note && (
        <p className="text-ink-600 text-sm mt-3">{highlight.note}</p>
      )}
      <p className="text-xs text-ink-400 mt-2">
        {new Date(highlight.createdAt).toLocaleDateString()}
      </p>
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
      <div className="w-16 h-16 rounded-full bg-paper-100 flex items-center justify-center mx-auto mb-4">
        <Icon className="text-ink-400" size={32} />
      </div>
      <h2 className="text-xl font-display font-bold text-ink-900 mb-2">
        {title}
      </h2>
      <p className="text-ink-600 mb-6">{description}</p>
      <Link to="/discover" className="btn btn-primary">
        Discover Content
      </Link>
    </div>
  );
}
