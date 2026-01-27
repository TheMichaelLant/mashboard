import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Rss, Type, FileText, BookOpen, UserPlus } from 'lucide-react';
import PostCard from '../components/PostCard';
import { feedApi, appreciationApi, bookmarkApi } from '../services/api';
import type { Post } from '../types';

type PostTypeFilter = 'all' | 'line' | 'page' | 'book';

export default function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [typeFilter, setTypeFilter] = useState<PostTypeFilter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      setLoading(true);
      try {
        const data = await feedApi.getFeed({
          type: typeFilter !== 'all' ? typeFilter : undefined,
        });
        setPosts(data);
      } catch (error) {
        console.error('Failed to fetch feed:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
  }, [typeFilter]);

  const handleAppreciate = async (postId: number) => {
    try {
      const post = posts.find((p) => p.id === postId);
      if (post?.isAppreciated) {
        await appreciationApi.unappreciate(postId);
      } else {
        await appreciationApi.appreciate(postId);
      }
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                isAppreciated: !p.isAppreciated,
                appreciationCount: p.isAppreciated
                  ? (p.appreciationCount || 1) - 1
                  : (p.appreciationCount || 0) + 1,
              }
            : p
        )
      );
    } catch (error) {
      console.error('Failed to toggle appreciation:', error);
    }
  };

  const handleBookmark = async (postId: number) => {
    try {
      const post = posts.find((p) => p.id === postId);
      if (post?.isBookmarked) {
        await bookmarkApi.unbookmark(postId);
      } else {
        await bookmarkApi.bookmark(postId);
      }
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, isBookmarked: !p.isBookmarked } : p
        )
      );
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Rss className="text-ink-700" size={28} />
          <h1 className="text-3xl font-display font-bold text-ink-900">Your Feed</h1>
        </div>
      </div>

      {/* Type Filter */}
      <div className="flex items-center space-x-2">
        <span className="text-sm text-ink-500">Show:</span>
        <TypeFilterButton
          active={typeFilter === 'all'}
          onClick={() => setTypeFilter('all')}
          label="All"
        />
        <TypeFilterButton
          active={typeFilter === 'line'}
          onClick={() => setTypeFilter('line')}
          icon={Type}
          label="Lines"
        />
        <TypeFilterButton
          active={typeFilter === 'page'}
          onClick={() => setTypeFilter('page')}
          icon={FileText}
          label="Pages"
        />
        <TypeFilterButton
          active={typeFilter === 'book'}
          onClick={() => setTypeFilter('book')}
          icon={BookOpen}
          label="Books"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-paper-200" />
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-paper-200 rounded" />
                  <div className="h-3 w-20 bg-paper-200 rounded" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-paper-200 rounded w-3/4" />
                <div className="h-4 bg-paper-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onAppreciate={handleAppreciate}
              onBookmark={handleBookmark}
            />
          ))}
        </div>
      ) : (
        <EmptyFeed />
      )}
    </div>
  );
}

interface TypeFilterButtonProps {
  active: boolean;
  onClick: () => void;
  icon?: React.ElementType;
  label: string;
}

function TypeFilterButton({ active, onClick, icon: Icon, label }: TypeFilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-sm transition-colors ${
        active
          ? 'bg-ink-900 text-paper-50'
          : 'bg-paper-100 text-ink-600 hover:bg-paper-200'
      }`}
    >
      {Icon && <Icon size={14} />}
      <span>{label}</span>
    </button>
  );
}

function EmptyFeed() {
  return (
    <div className="card p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-paper-100 flex items-center justify-center mx-auto mb-4">
        <UserPlus className="text-ink-400" size={32} />
      </div>
      <h2 className="text-xl font-display font-bold text-ink-900 mb-2">
        Your feed is empty
      </h2>
      <p className="text-ink-600 mb-6">
        Start following writers to see their posts here. Discover new voices and build your reading circle.
      </p>
      <Link to="/discover" className="btn btn-primary">
        Discover Writers
      </Link>
    </div>
  );
}
