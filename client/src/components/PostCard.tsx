import { Link } from 'react-router-dom';
import type { Post } from '../types';

interface PostCardProps {
  post: Post;
  variant?: 'feed' | 'list';
  onAppreciate?: (postId: number) => void;
  onBookmark?: (postId: number) => void;
}

export default function PostCard({ post, variant = 'feed', onBookmark }: PostCardProps) {
  const getPreviewContent = () => {
    if (post.isLocked) {
      return post.excerpt || 'This content is for subscribers only.';
    }

    if (post.excerpt) {
      return post.excerpt;
    }

    try {
      const content = JSON.parse(post.content);
      if (typeof content === 'string') {
        return content.slice(0, variant === 'feed' ? 300 : 150);
      }
      if (content.description) {
        return content.description.slice(0, variant === 'feed' ? 300 : 150);
      }
      return '';
    } catch {
      // Content is plain text or HTML
      const stripped = post.content.replace(/<[^>]*>/g, '');
      return stripped.slice(0, variant === 'feed' ? 300 : 150);
    }
  };

  // Estimate reading time (average 200 words per minute)
  const getReadingTime = () => {
    const content = post.content.replace(/<[^>]*>/g, '');
    const words = content.split(/\s+/).length;
    const minutes = Math.ceil(words / 200);
    return minutes === 1 ? '1 Minute Read' : `${minutes} Minute Read`;
  };

  const formatDate = (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const maxLen = variant === 'feed' ? 300 : 150;

  if (variant === 'list') {
    return (
      <article className="card p-6 hover:border-ink-600 transition-colors">
        {/* Title */}
        {post.title && (
          <Link to={`/post/${post.id}`} className="block group">
            <h2 className="text-xl font-display font-semibold text-ink-100 mb-3 group-hover:text-gold-600 transition-colors">
              {post.title}
            </h2>
          </Link>
        )}

        {/* Author Info */}
        <div className="flex items-center gap-3 mb-3">
          {post.author?.avatarUrl ? (
            <img
              src={post.author.avatarUrl}
              alt={post.author.displayName}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-ink-700 flex items-center justify-center">
              <span className="text-ink-400 text-sm font-medium">
                {post.author?.displayName?.charAt(0) || '?'}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-ink-400">
            <Link
              to={`/@${post.author?.username}`}
              className="hover:text-ink-200 transition-colors"
            >
              {post.author?.displayName}
            </Link>
            <span>·</span>
            <span>{formatDate(post.createdAt)}</span>
          </div>
        </div>

        {/* Content Preview */}
        <p className="text-ink-400 text-sm leading-relaxed mb-4">
          {getPreviewContent()}
          {!post.isLocked && post.content.length > maxLen && '...'}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <Link
              to={`/post/${post.id}`}
              className="text-gold-600 hover:text-gold-500 transition-colors"
            >
              Read More
            </Link>
            <span className="text-ink-700">|</span>
            <button
              onClick={() => onBookmark?.(post.id)}
              className={`transition-colors ${
                post.isBookmarked
                  ? 'text-gold-500'
                  : 'text-gold-600 hover:text-gold-500'
              }`}
            >
              {post.isBookmarked ? 'Bookmarked' : 'Bookmark'}
            </button>
          </div>
          <span className="text-ink-500">{getReadingTime()}</span>
        </div>
      </article>
    );
  }

  // Feed variant (snap-scroll)
  return (
    <article className="snap-item flex items-center justify-center px-8 py-16">
      <div className="max-w-3xl w-full">
        {/* Title */}
        {post.title && (
          <Link to={`/post/${post.id}`} className="block group">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-ink-50 mb-6 leading-tight group-hover:text-gold-600 transition-colors">
              {post.title}
            </h2>
          </Link>
        )}

        {/* Author Info */}
        <div className="flex items-center gap-4 mb-6">
          {post.author?.avatarUrl ? (
            <img
              src={post.author.avatarUrl}
              alt={post.author.displayName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-ink-700 flex items-center justify-center">
              <span className="text-ink-400 font-medium">
                {post.author?.displayName?.charAt(0) || '?'}
              </span>
            </div>
          )}
          <div>
            <Link
              to={`/@${post.author?.username}`}
              className="text-ink-300 hover:text-ink-100 transition-colors text-sm"
            >
              Author: {post.author?.displayName}
            </Link>
            <div className="text-ink-500 text-sm">
              Posted on: {formatDate(post.createdAt)}
            </div>
          </div>
        </div>

        {/* Content Preview */}
        <div className="text-ink-400 leading-relaxed text-lg mb-6">
          {getPreviewContent()}
          {!post.isLocked && post.content.length > maxLen && '...'}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 mb-4">
          <Link
            to={`/post/${post.id}`}
            className="text-gold-600 hover:text-gold-500 transition-colors"
          >
            Read More
          </Link>
          <span className="text-ink-600">|</span>
          <button
            onClick={() => onBookmark?.(post.id)}
            className={`transition-colors ${
              post.isBookmarked
                ? 'text-gold-500'
                : 'text-gold-600 hover:text-gold-500'
            }`}
          >
            {post.isBookmarked ? 'Bookmarked' : 'Bookmark'}
          </button>
        </div>

        {/* Reading Time */}
        <div className="text-ink-500 text-sm">
          {getReadingTime()}
        </div>
      </div>
    </article>
  );
}
