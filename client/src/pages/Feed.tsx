import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import PostCard from '../components/PostCard';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { feedApi, bookmarkApi } from '../services/api';
import type { Post } from '../types';

const FEED_SCROLL_KEY = 'feed-scroll-position';

export default function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasRestoredScroll = useRef(false);

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

  // Restore scroll position after posts load
  useEffect(() => {
    if (!loading && posts.length > 0 && containerRef.current && !hasRestoredScroll.current) {
      const savedPosition = sessionStorage.getItem(FEED_SCROLL_KEY);
      if (savedPosition) {
        // Small delay to ensure DOM is ready
        requestAnimationFrame(() => {
          containerRef.current?.scrollTo({ top: parseInt(savedPosition, 10) });
        });
      }
      hasRestoredScroll.current = true;
    }
  }, [loading, posts.length]);

  // Save scroll position on scroll
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      sessionStorage.setItem(FEED_SCROLL_KEY, containerRef.current.scrollTop.toString());
    }
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
    return <LoadingSkeleton variant="feed" />;
  }

  if (posts.length === 0) {
    return <EmptyFeed />;
  }

  return (
    <div ref={containerRef} onScroll={handleScroll} className="snap-container">
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
