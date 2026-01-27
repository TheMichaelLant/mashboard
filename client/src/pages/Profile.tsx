import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { UserPlus, UserMinus, Users, FileText, Heart, Lock, Type, BookOpen } from 'lucide-react';
import PostCard from '../components/PostCard';
import {
  userApi,
  postApi,
  followApi,
  appreciationApi,
  bookmarkApi,
  subscriptionApi,
} from '../services/api';
import type { User, Post, PostType } from '../types';

type Tab = 'posts' | 'appreciated';
type PostTypeFilter = 'all' | 'line' | 'page' | 'book';

export default function Profile() {
  const { username } = useParams<{ username: string }>();
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
    return (
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="flex items-center space-x-4 mb-8">
          <div className="w-24 h-24 rounded-full bg-paper-200" />
          <div className="space-y-2">
            <div className="h-8 w-48 bg-paper-200 rounded" />
            <div className="h-4 w-32 bg-paper-200 rounded" />
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-paper-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-display font-bold text-ink-900 mb-2">
          Error Loading Profile
        </h2>
        <p className="text-ink-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn btn-primary"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-display font-bold text-ink-900 mb-2">
          User not found
        </h2>
        <p className="text-ink-600">
          The user @{username} doesn't exist.
        </p>
      </div>
    );
  }

  const isOwnProfile = userId === user.id;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Profile Header */}
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:space-x-6">
          {/* Avatar */}
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="w-24 h-24 rounded-full object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-ink-200 flex items-center justify-center">
              <span className="text-ink-600 font-bold text-3xl">
                {user.displayName.charAt(0)}
              </span>
            </div>
          )}

          {/* Info */}
          <div className="flex-1 mt-4 sm:mt-0">
            <h1 className="text-3xl font-display font-bold text-ink-900">
              {user.displayName}
            </h1>
            <p className="text-ink-500">@{user.username}</p>
            {user.bio && (
              <p className="text-ink-700 mt-2 max-w-xl">{user.bio}</p>
            )}

            {/* Stats */}
            <div className="flex items-center space-x-6 mt-4 text-sm">
              <div>
                <span className="font-semibold text-ink-900">
                  {user.postCount || 0}
                </span>{' '}
                <span className="text-ink-500">posts</span>
              </div>
              <div>
                <span className="font-semibold text-ink-900">
                  {user.followerCount || 0}
                </span>{' '}
                <span className="text-ink-500">followers</span>
              </div>
              <div>
                <span className="font-semibold text-ink-900">
                  {user.followingCount || 0}
                </span>{' '}
                <span className="text-ink-500">following</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {!isOwnProfile && isSignedIn && (
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 mt-4 sm:mt-0">
              <button
                onClick={handleFollow}
                className={`btn ${
                  user.isFollowing ? 'btn-secondary' : 'btn-primary'
                }`}
              >
                {user.isFollowing ? (
                  <>
                    <UserMinus size={18} className="mr-2" />
                    Unfollow
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
                  className={`btn ${isSubscribed ? 'btn-secondary' : 'btn-ghost'}`}
                >
                  <Lock size={18} className="mr-2" />
                  {isSubscribed ? 'Subscribed' : `Subscribe ${user.creatorSettings.subscriptionPrice ? `$${user.creatorSettings.subscriptionPrice}/mo` : ''}`}
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center space-x-1 border-b border-paper-100 mb-6">
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'posts'
              ? 'border-ink-900 text-ink-900'
              : 'border-transparent text-ink-500 hover:text-ink-700'
          }`}
        >
          <FileText size={18} />
          <span className="font-medium">Posts</span>
        </button>
        <button
          onClick={() => setActiveTab('appreciated')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'appreciated'
              ? 'border-ink-900 text-ink-900'
              : 'border-transparent text-ink-500 hover:text-ink-700'
          }`}
        >
          <Heart size={18} />
          <span className="font-medium">Appreciated</span>
        </button>
      </div>

      {/* Type Filter (for posts tab) */}
      {activeTab === 'posts' && (
        <div className="flex items-center space-x-2 mb-6">
          <span className="text-sm text-ink-500">Filter:</span>
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
      )}

      {/* Content */}
      {(activeTab === 'posts' ? posts : appreciatedPosts).length > 0 ? (
        <div className="space-y-4">
          {(activeTab === 'posts' ? posts : appreciatedPosts).map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onAppreciate={handleAppreciate}
              onBookmark={handleBookmark}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
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
