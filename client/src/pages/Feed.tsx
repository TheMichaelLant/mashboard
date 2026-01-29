import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import PostCard from '../components/PostCard';
import { feedApi, bookmarkApi } from '../services/api';
import type { Post } from '../types';

export default function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      setLoading(true);
      try {
        const data = await feedApi.getFeed({});
        setPosts(data);
      } catch (error) {
        console.error('Failed to fetch feed:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
  }, []);

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

  if (loading) {
    return (
      <div className="snap-container">
        <div className="snap-item flex items-center justify-center">
          <div className="max-w-3xl w-full px-8 animate-pulse">
            <div className="h-16 bg-ink-800 rounded w-3/4 mb-6" />
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-ink-800" />
              <div className="space-y-2">
                <div className="h-4 bg-ink-800 rounded w-40" />
                <div className="h-3 bg-ink-800 rounded w-32" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-4 bg-ink-800 rounded w-full" />
              <div className="h-4 bg-ink-800 rounded w-5/6" />
              <div className="h-4 bg-ink-800 rounded w-4/6" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return <EmptyFeed />;
  }

  return (
    <div className="snap-container">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onBookmark={handleBookmark}
        />
      ))}
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="snap-container">
      <div className="snap-item flex items-center justify-center">
        <div className="text-center max-w-md px-8">
          <div className="w-20 h-20 rounded-full bg-ink-800 flex items-center justify-center mx-auto mb-6">
            <UserPlus className="text-ink-500" size={36} />
          </div>
          <h2 className="text-3xl font-display font-bold text-ink-100 mb-4">
            Your feed is empty
          </h2>
          <p className="text-ink-400 mb-8 leading-relaxed">
            Start following writers to see their posts here. Discover new voices and build your reading circle.
          </p>
          <Link
            to="/discover"
            className="inline-block text-gold-600 hover:text-gold-500 transition-colors text-lg"
          >
            Discover Writers
          </Link>
        </div>
      </div>
    </div>
  );
}
