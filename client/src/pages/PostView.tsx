import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import {
  Heart,
  Bookmark,
  Archive,
  Share2,
  Lock,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  Highlighter,
} from 'lucide-react';
import {
  postApi,
  appreciationApi,
  bookmarkApi,
  highlightApi,
  subscriptionApi,
} from '../services/api';
import type { Post, Highlight } from '../types';

export default function PostView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId, isSignedIn } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [selectedText, setSelectedText] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);
  const [showHighlightMenu, setShowHighlightMenu] = useState(false);
  const [highlightPosition, setHighlightPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const fetchPost = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await postApi.getById(parseInt(id));
        setPost(data);

        // Fetch user's highlights for this post
        if (isSignedIn) {
          const userHighlights = await highlightApi.getPostHighlights(parseInt(id));
          setHighlights(userHighlights);
        }
      } catch (error) {
        console.error('Failed to fetch post:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [id, isSignedIn]);

  const handleAppreciate = async () => {
    if (!post || !isSignedIn) return;
    try {
      if (post.isAppreciated) {
        await appreciationApi.unappreciate(post.id);
      } else {
        await appreciationApi.appreciate(post.id);
      }
      setPost((prev) =>
        prev
          ? {
              ...prev,
              isAppreciated: !prev.isAppreciated,
              appreciationCount: prev.isAppreciated
                ? (prev.appreciationCount || 1) - 1
                : (prev.appreciationCount || 0) + 1,
            }
          : null
      );
    } catch (error) {
      console.error('Failed to toggle appreciation:', error);
    }
  };

  const handleBookmark = async () => {
    if (!post || !isSignedIn) return;
    try {
      if (post.isBookmarked) {
        await bookmarkApi.unbookmark(post.id);
      } else {
        await bookmarkApi.bookmark(post.id);
      }
      setPost((prev) =>
        prev ? { ...prev, isBookmarked: !prev.isBookmarked } : null
      );
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    }
  };

  const handleArchive = async () => {
    if (!post || !isSignedIn || post.type !== 'book') return;
    try {
      if (post.isArchived) {
        await bookmarkApi.unarchive(post.id);
      } else {
        await bookmarkApi.archive(post.id);
      }
      setPost((prev) =>
        prev ? { ...prev, isArchived: !prev.isArchived } : null
      );
    } catch (error) {
      console.error('Failed to toggle archive:', error);
    }
  };

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !isSignedIn || post?.isLocked) {
      setShowHighlightMenu(false);
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setSelectedText({
        text,
        start: range.startOffset,
        end: range.endOffset,
      });
      setHighlightPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      });
      setShowHighlightMenu(true);
    }
  }, [isSignedIn, post?.isLocked]);

  const handleCreateHighlight = async () => {
    if (!post || !selectedText || !isSignedIn) return;
    try {
      const newHighlight = await highlightApi.create({
        postId: post.id,
        chapterId: post.type === 'book' ? post.chapters?.[currentChapter]?.id : undefined,
        selectedText: selectedText.text,
        startOffset: selectedText.start,
        endOffset: selectedText.end,
      });
      setHighlights((prev) => [...prev, newHighlight]);
      setShowHighlightMenu(false);
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      console.error('Failed to create highlight:', error);
    }
  };

  const handleSubscribe = async () => {
    if (!post || !isSignedIn) return;
    try {
      await subscriptionApi.subscribe(post.authorId);
      // Refetch post to update access
      const data = await postApi.getById(post.id);
      setPost(data);
    } catch (error) {
      console.error('Failed to subscribe:', error);
    }
  };

  const handleDelete = async () => {
    if (!post) return;
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await postApi.delete(post.id);
        navigate('/');
      } catch (error) {
        console.error('Failed to delete post:', error);
      }
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse">
        <div className="h-8 bg-paper-200 rounded w-3/4 mb-4" />
        <div className="h-4 bg-paper-200 rounded w-1/4 mb-8" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 bg-paper-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-display font-bold text-ink-900 mb-2">
          Post not found
        </h2>
        <p className="text-ink-600 mb-4">
          The post you're looking for doesn't exist or has been removed.
        </p>
        <Link to="/discover" className="btn btn-primary">
          Discover Posts
        </Link>
      </div>
    );
  }

  const isOwner = userId === post.authorId;
  const currentContent =
    post.type === 'book' && post.chapters?.length
      ? post.chapters[currentChapter]?.content
      : post.content;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back Link */}
      <Link
        to={-1 as unknown as string}
        onClick={(e) => {
          e.preventDefault();
          navigate(-1);
        }}
        className="inline-flex items-center text-ink-500 hover:text-ink-700 mb-6"
      >
        <ChevronLeft size={20} />
        <span>Back</span>
      </Link>

      {/* Post Header */}
      <header className="mb-8">
        {post.title && (
          <h1 className="text-4xl md:text-5xl font-display font-bold text-ink-900 mb-4">
            {post.title}
          </h1>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {post.author?.avatarUrl ? (
              <img
                src={post.author.avatarUrl}
                alt={post.author.displayName}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-ink-200 flex items-center justify-center">
                <span className="text-ink-600 font-medium text-lg">
                  {post.author?.displayName?.charAt(0) || '?'}
                </span>
              </div>
            )}
            <div>
              <Link
                to={`/@${post.author?.username}`}
                className="font-medium text-ink-900 hover:underline"
              >
                {post.author?.displayName}
              </Link>
              <p className="text-sm text-ink-500">
                {new Date(post.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
          {isOwner && (
            <div className="flex items-center space-x-2">
              <Link
                to={`/edit/${post.id}`}
                className="btn btn-ghost btn-sm"
              >
                <Edit size={16} className="mr-1" />
                Edit
              </Link>
              <button
                onClick={handleDelete}
                className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 size={16} className="mr-1" />
                Delete
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Categories */}
      {post.categories && post.categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {post.categories.map(({ category }) => (
            <Link
              key={category.id}
              to={`/discover/category/${category.slug}`}
              className="text-sm px-3 py-1 bg-paper-100 text-ink-600 rounded-full hover:bg-paper-200"
            >
              #{category.name}
            </Link>
          ))}
        </div>
      )}

      {/* Book Chapter Navigation */}
      {post.type === 'book' && post.chapters && post.chapters.length > 0 && (
        <div className="bg-paper-100 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentChapter((prev) => Math.max(0, prev - 1))}
              disabled={currentChapter === 0}
              className="btn btn-ghost btn-sm disabled:opacity-50"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <div className="text-center">
              <p className="text-sm text-ink-500">
                Chapter {currentChapter + 1} of {post.chapters.length}
              </p>
              <h2 className="font-medium text-ink-900">
                {post.chapters[currentChapter].title}
              </h2>
            </div>
            <button
              onClick={() =>
                setCurrentChapter((prev) =>
                  Math.min(post.chapters!.length - 1, prev + 1)
                )
              }
              disabled={currentChapter === post.chapters.length - 1}
              className="btn btn-ghost btn-sm disabled:opacity-50"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Locked Content */}
      {post.isLocked ? (
        <div className="bg-paper-100 rounded-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="text-amber-600" size={32} />
          </div>
          <h2 className="text-xl font-display font-bold text-ink-900 mb-2">
            Premium Content
          </h2>
          <p className="text-ink-600 mb-6">
            {post.excerpt || 'This content is available to subscribers only.'}
          </p>
          {isSignedIn ? (
            <button onClick={handleSubscribe} className="btn btn-primary">
              Subscribe to {post.author?.displayName}
            </button>
          ) : (
            <Link to="/sign-in" className="btn btn-primary">
              Sign in to Subscribe
            </Link>
          )}
        </div>
      ) : (
        /* Post Content */
        <article
          className={`${
            post.type === 'line'
              ? 'font-display text-3xl md:text-4xl leading-relaxed'
              : 'font-body text-lg leading-relaxed'
          }`}
          onMouseUp={handleTextSelection}
        >
          <div
            className="tiptap-editor prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: currentContent }}
          />
        </article>
      )}

      {/* Highlight Menu */}
      {showHighlightMenu && selectedText && (
        <div
          className="fixed bg-ink-900 text-paper-50 rounded-lg shadow-lg p-2 z-50"
          style={{
            left: highlightPosition.x,
            top: highlightPosition.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <button
            onClick={handleCreateHighlight}
            className="flex items-center space-x-2 px-3 py-1.5 hover:bg-ink-700 rounded"
          >
            <Highlighter size={16} />
            <span>Highlight</span>
          </button>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-paper-200">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleAppreciate}
            disabled={!isSignedIn}
            className={`flex items-center space-x-2 transition-colors ${
              post.isAppreciated
                ? 'text-red-500'
                : 'text-ink-500 hover:text-red-500'
            } disabled:opacity-50`}
          >
            <Heart
              size={24}
              fill={post.isAppreciated ? 'currentColor' : 'none'}
            />
            <span>{post.appreciationCount || 0}</span>
          </button>
          <button
            onClick={handleBookmark}
            disabled={!isSignedIn}
            className={`flex items-center space-x-2 transition-colors ${
              post.isBookmarked
                ? 'text-blue-500'
                : 'text-ink-500 hover:text-blue-500'
            } disabled:opacity-50`}
          >
            <Bookmark
              size={24}
              fill={post.isBookmarked ? 'currentColor' : 'none'}
            />
            <span>Save</span>
          </button>
          {post.type === 'book' && (
            <button
              onClick={handleArchive}
              disabled={!isSignedIn}
              className={`flex items-center space-x-2 transition-colors ${
                post.isArchived
                  ? 'text-green-500'
                  : 'text-ink-500 hover:text-green-500'
              } disabled:opacity-50`}
            >
              <Archive
                size={24}
                fill={post.isArchived ? 'currentColor' : 'none'}
              />
              <span>Archive</span>
            </button>
          )}
        </div>
        <button
          onClick={handleShare}
          className="flex items-center space-x-2 text-ink-500 hover:text-ink-700"
        >
          <Share2 size={24} />
          <span>Share</span>
        </button>
      </div>

      {/* User's Highlights */}
      {highlights.length > 0 && (
        <div className="mt-8 pt-6 border-t border-paper-200">
          <h3 className="font-heading font-semibold text-ink-900 mb-4">
            Your Highlights
          </h3>
          <div className="space-y-3">
            {highlights.map((highlight) => (
              <div
                key={highlight.id}
                className="bg-yellow-50 border-l-4 border-yellow-300 p-4 rounded-r-lg"
              >
                <p className="text-ink-800 italic">"{highlight.selectedText}"</p>
                {highlight.note && (
                  <p className="text-ink-600 text-sm mt-2">{highlight.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
