import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Search, TrendingUp, Clock, Users, Hash, Type, FileText, BookOpen } from 'lucide-react';
import PostCard from '../components/PostCard';
import { discoverApi, categoryApi, appreciationApi, bookmarkApi } from '../services/api';
import type { Post, Category, User } from '../types';
import { useAuth } from '@clerk/clerk-react';

type Tab = 'trending' | 'latest' | 'writers';
type PostTypeFilter = 'all' | 'line' | 'page' | 'book';

export default function Discover() {
  const { slug } = useParams<{ slug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSignedIn } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('trending');
  const [typeFilter, setTypeFilter] = useState<PostTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [_isSearching, setIsSearching] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [writers, setWriters] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch popular categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await categoryApi.getPopular();
        setCategories(data);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };
    fetchCategories();
  }, []);

  // Fetch content based on current tab/filters
  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      try {
        const params = {
          type: typeFilter !== 'all' ? typeFilter : undefined,
        };

        if (slug) {
          // Category view
          const data = await discoverApi.getByCategory(slug, params);
          setSelectedCategory(data.category);
          setPosts(data.posts);
        } else if (searchQuery) {
          // Search view
          setIsSearching(true);
          const data = await discoverApi.search({ q: searchQuery, ...params });
          setPosts(data.posts);
        } else if (activeTab === 'writers') {
          const data = await discoverApi.getWriters();
          setWriters(data);
        } else if (activeTab === 'latest') {
          const data = await discoverApi.getLatest(params);
          setPosts(data);
        } else {
          // Trending (default)
          const data = await discoverApi.getTrending(params);
          setPosts(data);
        }
      } catch (error) {
        console.error('Failed to fetch content:', error);
      } finally {
        setLoading(false);
        setIsSearching(false);
      }
    };
    fetchContent();
  }, [activeTab, typeFilter, slug, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchParams({ q: searchQuery });
    } else {
      setSearchParams({});
    }
  };

  const handleAppreciate = async (postId: number) => {
    if (!isSignedIn) return;
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
    if (!isSignedIn) return;
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
    <div className="px-8 py-12">
      <div className="grid lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-500"
              size={20}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts and writers..."
              className="input pl-12 pr-4 py-3"
            />
          </form>

          {/* Category Header (if viewing a category) */}
          {selectedCategory && (
            <div className="card p-6">
              <div className="flex items-center space-x-2 text-ink-400 mb-2">
                <Hash size={20} />
                <span className="font-medium">Category</span>
              </div>
              <h1 className="text-3xl font-display font-bold text-ink-100">
                {selectedCategory.name}
              </h1>
              {selectedCategory.description && (
                <p className="text-ink-400 mt-2">{selectedCategory.description}</p>
              )}
            </div>
          )}

          {/* Tabs */}
          {!slug && !searchQuery && (
            <div className="flex items-center space-x-1 border-b border-ink-700">
              <TabButton
                active={activeTab === 'trending'}
                onClick={() => setActiveTab('trending')}
                icon={TrendingUp}
                label="Trending"
              />
              <TabButton
                active={activeTab === 'latest'}
                onClick={() => setActiveTab('latest')}
                icon={Clock}
                label="Latest"
              />
              <TabButton
                active={activeTab === 'writers'}
                onClick={() => setActiveTab('writers')}
                icon={Users}
                label="Writers"
              />
            </div>
          )}

          {/* Type Filter */}
          {activeTab !== 'writers' && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-ink-400">Filter:</span>
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
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-6 animate-pulse">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-ink-700" />
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-ink-700 rounded" />
                      <div className="h-3 w-20 bg-ink-700 rounded" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-ink-700 rounded w-3/4" />
                    <div className="h-4 bg-ink-700 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === 'writers' && !slug && !searchQuery ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {writers.map((writer) => (
                <WriterCard key={writer.id} writer={writer} />
              ))}
            </div>
          ) : posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map((post) => (
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
            <div className="text-center py-12">
              <p className="text-ink-400">No posts found.</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Popular Categories */}
          <div className="card p-4">
            <h3 className="font-heading font-semibold text-ink-100 mb-4">
              Popular Categories
            </h3>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/discover/category/${category.slug}`}
                  className={`text-sm px-3 py-1.5 rounded-full transition-colors ${
                    selectedCategory?.id === category.id
                      ? 'bg-gold-600 text-ink-950'
                      : 'bg-ink-700 text-ink-300 hover:bg-ink-600'
                  }`}
                >
                  #{category.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Info Card */}
          <div className="card p-4">
            <h3 className="font-heading font-semibold text-ink-100 mb-2">
              About Discover
            </h3>
            <p className="text-sm text-ink-400">
              Explore trending posts, discover new writers, and find content that
              resonates with you. Use categories to narrow your search.
            </p>
          </div>
        </aside>
      </div>
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
      className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
        active
          ? 'border-gold-600 text-gold-600'
          : 'border-transparent text-ink-400 hover:text-ink-200'
      }`}
    >
      <Icon size={18} />
      <span className="font-medium">{label}</span>
    </button>
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
          ? 'bg-gold-600 text-ink-950'
          : 'bg-ink-700 text-ink-300 hover:bg-ink-600'
      }`}
    >
      {Icon && <Icon size={14} />}
      <span>{label}</span>
    </button>
  );
}

interface WriterCardProps {
  writer: User & { totalAppreciations?: number; postCount?: number };
}

function WriterCard({ writer }: WriterCardProps) {
  return (
    <Link
      to={`/@${writer.username}`}
      className="card p-4 hover:border-ink-600 transition-colors"
    >
      <div className="flex items-center space-x-3">
        {writer.avatarUrl ? (
          <img
            src={writer.avatarUrl}
            alt={writer.displayName}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-ink-700 flex items-center justify-center">
            <span className="text-ink-300 font-medium text-lg">
              {writer.displayName.charAt(0)}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-ink-100 truncate">
            {writer.displayName}
          </h4>
          <p className="text-sm text-ink-400">@{writer.username}</p>
        </div>
      </div>
      {writer.bio && (
        <p className="text-sm text-ink-400 mt-3 line-clamp-2">{writer.bio}</p>
      )}
      <div className="flex items-center space-x-4 mt-3 text-sm text-ink-500">
        <span>{writer.postCount || 0} posts</span>
        <span>{writer.followerCount || 0} followers</span>
      </div>
    </Link>
  );
}
