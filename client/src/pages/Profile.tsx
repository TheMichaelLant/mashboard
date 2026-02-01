import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { UserPlus, UserMinus, Lock, Type, FileText, BookOpen, Heart } from 'lucide-react';
import PostCard from '../components/PostCard';
import LoadingSkeleton from '../components/LoadingSkeleton';
import {
  userApi,
  postApi,
  followApi,
  appreciationApi,
  bookmarkApi,
  subscriptionApi,
} from '../services/api';
import type { User, Post } from '../types';

type Tab = 'posts' | 'appreciated';
type PostTypeFilter = 'all' | 'line' | 'page' | 'book';

export default function Profile() {
  const { handle } = useParams<{ handle: string }>();
  const username = handle?.startsWith('@') ? handle.slice(1) : handle;
  const { userId, isSignedIn } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [appreciatedPosts, setAppreciatedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [typeFilter, setTypeFilter] = useState<PostTypeFilter>('all');
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Fetch user profile
  useEffect(() => {
    const fetchUser = async () => {
      if (!username) return;
      setLoading(true);
      setError(null);
      try {
        const userData = await userApi.getByUsername(username);
        setUser(userData);

        // Check subscription status
        if (isSignedIn && userData.id !== userId && userData.creatorSettings?.acceptsSubscriptions) {
          const { isSubscribed: subStatus } = await subscriptionApi.checkSubscription(userData.id);
          setIsSubscribed(subStatus);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
        setError(error instanceof Error ? error.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [username, isSignedIn, userId]);

  // Fetch posts when user or filter changes
  useEffect(() => {
    const fetchPosts = async () => {
      if (!user) return;
      try {
        if (activeTab === 'posts') {
          const data = await postApi.getUserPosts(user.id, {
            type: typeFilter !== 'all' ? typeFilter : undefined,
          });
          setPosts(data);
        } else {
          const data = await appreciationApi.getUserAppreciations(user.id);
          setAppreciatedPosts(data);
        }
      } catch (error) {
        console.error('Failed to fetch posts:', error);
      }
    };
    fetchPosts();
  }, [user, activeTab, typeFilter]);

  const handleFollow = async () => {
    if (!user || !isSignedIn) return;
    try {
      if (user.isFollowing) {
        await followApi.unfollow(user.id);
      } else {
        await followApi.follow(user.id);
      }
      setUser((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: !prev.isFollowing,
              followerCount: prev.isFollowing
                ? (prev.followerCount || 1) - 1
                : (prev.followerCount || 0) + 1,
            }
          : null
      );
    } catch (error) {
      console.error('Failed to toggle follow:', error);
    }
  };

  const handleSubscribe = async () => {
    if (!user || !isSignedIn) return;
    try {
      if (isSubscribed) {
        await subscriptionApi.unsubscribe(user.id);
      } else {
        await subscriptionApi.subscribe(user.id);
      }
      setIsSubscribed(!isSubscribed);
    } catch (error) {
      console.error('Failed to toggle subscription:', error);
    }
  };

  const handleAppreciate = async (postId: number) => {
    if (!isSignedIn) return;
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
      const post = posts.find((p) => p.id === postId) || appreciatedPosts.find((p) => p.id === postId);
      if (post?.isAppreciated) {
        await appreciationApi.unappreciate(postId);
      } else {
        await appreciationApi.appreciate(postId);
      }
      setPosts(updatePosts);
      setAppreciatedPosts(updatePosts);
    } catch (error) {
      console.error('Failed to toggle appreciation:', error);
    }
  };

  const handleBookmark = async (postId: number) => {
    if (!isSignedIn) return;
    const updatePosts = (list: Post[]) =>
      list.map((p) =>
        p.id === postId ? { ...p, isBookmarked: !p.isBookmarked } : p
      );

    try {
      const post = posts.find((p) => p.id === postId) || appreciatedPosts.find((p) => p.id === postId);
      if (post?.isBookmarked) {
        await bookmarkApi.unbookmark(postId);
      } else {
        await bookmarkApi.bookmark(postId);
      }
      setPosts(updatePosts);
      setAppreciatedPosts(updatePosts);
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    }
  };

  if (loading) {
    return <LoadingSkeleton variant="profile" />;
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="card p-12">
          <h2 className="text-2xl font-display font-bold text-ink-100 mb-3">
            Error Loading Profile
          </h2>
          <p className="text-ink-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="card p-12">
          <h2 className="text-2xl font-display font-bold text-ink-100 mb-3">
            User Not Found
          </h2>
          <p className="text-ink-400">
            The user @{username} doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  const isOwnProfile = userId === user.id;
  const currentPosts = activeTab === 'posts' ? posts : appreciatedPosts;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Profile Header */}
      <header className="text-center mb-12">
        {/* Avatar */}
        <div className="mb-6">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="w-28 h-28 rounded-full object-cover mx-auto ring-4 ring-ink-800"
            />
          ) : (
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-ink-700 to-ink-800 flex items-center justify-center mx-auto ring-4 ring-ink-800">
              <span className="text-ink-300 font-display text-4xl">
                {user.displayName.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* Name & Username */}
        <h1 className="text-3xl font-display font-bold text-ink-50 mb-1">
          {user.displayName}
        </h1>
        <p className="text-ink-500 mb-4">@{user.username}</p>

        {/* Bio */}
        {user.bio && (
          <p className="text-ink-300 max-w-lg mx-auto mb-6 leading-relaxed">
            {user.bio}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center justify-center gap-8 mb-8">
          <Stat value={user.postCount || 0} label="Posts" />
          <Stat value={user.followerCount || 0} label="Followers" />
          <Stat value={user.followingCount || 0} label="Following" />
        </div>

        {/* Actions */}
        {!isOwnProfile && isSignedIn && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleFollow}
              className={`btn ${user.isFollowing ? 'btn-secondary' : 'btn-primary'}`}
            >
              {user.isFollowing ? (
                <>
                  <UserMinus size={18} className="mr-2" />
                  Following
                </>
              ) : (
                <>
                  <UserPlus size={18} className="mr-2" />
                  Follow
                </>
              )}
            </button>
            {user.creatorSettings?.acceptsSubscriptions && (
              <button
                onClick={handleSubscribe}
                className={`btn ${isSubscribed ? 'btn-secondary' : 'btn-outline'}`}
              >
                <Lock size={18} className="mr-2" />
                {isSubscribed
                  ? 'Subscribed'
                  : `Subscribe ${user.creatorSettings.subscriptionPrice ? `$${user.creatorSettings.subscriptionPrice}/mo` : ''}`}
              </button>
            )}
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <TabButton
          active={activeTab === 'posts'}
          onClick={() => setActiveTab('posts')}
          icon={FileText}
          label="Posts"
        />
        <TabButton
          active={activeTab === 'appreciated'}
          onClick={() => setActiveTab('appreciated')}
          icon={Heart}
          label="Appreciated"
        />
      </div>

      {/* Type Filter (for posts tab) */}
      {activeTab === 'posts' && (
        <div className="flex items-center justify-center gap-2 mb-8">
          <FilterChip
            active={typeFilter === 'all'}
            onClick={() => setTypeFilter('all')}
            label="All"
          />
          <FilterChip
            active={typeFilter === 'line'}
            onClick={() => setTypeFilter('line')}
            icon={Type}
            label="Lines"
          />
          <FilterChip
            active={typeFilter === 'page'}
            onClick={() => setTypeFilter('page')}
            icon={FileText}
            label="Pages"
          />
          <FilterChip
            active={typeFilter === 'book'}
            onClick={() => setTypeFilter('book')}
            icon={BookOpen}
            label="Books"
          />
        </div>
      )}

      {/* Content */}
      {currentPosts.length > 0 ? (
        <div className="space-y-4">
          {currentPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              variant="list"
              onAppreciate={handleAppreciate}
              onBookmark={handleBookmark}
            />
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <p className="text-ink-500">
            {activeTab === 'posts'
              ? `${isOwnProfile ? "You haven't" : `${user.displayName} hasn't`} published any posts yet.`
              : `${isOwnProfile ? "You haven't" : `${user.displayName} hasn't`} appreciated any posts yet.`}
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-xl font-semibold text-ink-100">{value}</div>
      <div className="text-sm text-ink-500">{label}</div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}

function TabButton({ active, onClick, icon: Icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
        active
          ? 'bg-ink-800 text-ink-100'
          : 'text-ink-500 hover:text-ink-300 hover:bg-ink-800/50'
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  icon?: React.ElementType;
  label: string;
}

function FilterChip({ active, onClick, icon: Icon, label }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
        active
          ? 'bg-gold-600 text-ink-950'
          : 'bg-ink-800 text-ink-400 hover:text-ink-200 hover:bg-ink-700'
      }`}
    >
      {Icon && <Icon size={14} />}
      <span>{label}</span>
    </button>
  );
}
