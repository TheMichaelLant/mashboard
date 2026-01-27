import { Link } from 'react-router-dom';
import { Heart, Bookmark, BookOpen, FileText, Type, Lock } from 'lucide-react';
import type { Post } from '../types';

interface PostCardProps {
  post: Post;
  onAppreciate?: (postId: number) => void;
  onBookmark?: (postId: number) => void;
}

const typeIcons = {
  line: Type,
  page: FileText,
  book: BookOpen,
};

const typeLabels = {
  line: 'Line',
  page: 'Page',
  book: 'Book',
};

export default function PostCard({ post, onAppreciate, onBookmark }: PostCardProps) {
  const TypeIcon = typeIcons[post.type];

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
        return content.slice(0, 200);
      }
      if (content.description) {
        return content.description.slice(0, 200);
      }
      return '';
    } catch {
      // Content is plain text or HTML
      const stripped = post.content.replace(/<[^>]*>/g, '');
      return stripped.slice(0, 200);
    }
  };

  return (
    <article className="card p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          {post.author?.avatarUrl ? (
            <img
              src={post.author.avatarUrl}
              alt={post.author.displayName}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-ink-200 flex items-center justify-center">
              <span className="text-ink-600 font-medium">
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
            <div className="flex items-center space-x-2 text-sm text-ink-500">
              <TypeIcon size={14} />
              <span>{typeLabels[post.type]}</span>
              {post.isPaid && (
                <>
                  <span>·</span>
                  <span className="flex items-center text-amber-600">
                    <Lock size={12} className="mr-1" />
                    Paid
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <time className="text-sm text-ink-400">
          {new Date(post.createdAt).toLocaleDateString()}
        </time>
      </div>

      {/* Content */}
      <Link to={`/post/${post.id}`} className="block group">
        {post.title && (
          <h2 className="text-xl font-display font-semibold text-ink-900 mb-2 group-hover:text-ink-700">
            {post.title}
          </h2>
        )}
        <div
          className={`text-ink-600 leading-relaxed ${
            post.type === 'line'
              ? 'font-display text-2xl'
              : 'font-body'
          } ${post.isLocked ? 'italic' : ''}`}
        >
          {getPreviewContent()}
          {!post.isLocked && post.content.length > 200 && '...'}
        </div>
      </Link>

      {/* Categories */}
      {post.categories && post.categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
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

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-paper-100">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => onAppreciate?.(post.id)}
            className={`flex items-center space-x-1.5 transition-colors ${
              post.isAppreciated
                ? 'text-red-500'
                : 'text-ink-400 hover:text-red-500'
            }`}
          >
            <Heart size={18} fill={post.isAppreciated ? 'currentColor' : 'none'} />
            <span className="text-sm">{post.appreciationCount || 0}</span>
          </button>
          <button
            onClick={() => onBookmark?.(post.id)}
            className={`flex items-center space-x-1.5 transition-colors ${
              post.isBookmarked
                ? 'text-blue-500'
                : 'text-ink-400 hover:text-blue-500'
            }`}
          >
            <Bookmark size={18} fill={post.isBookmarked ? 'currentColor' : 'none'} />
          </button>
        </div>
        {post.type === 'book' && post.chapters && (
          <span className="text-sm text-ink-400">
            {post.chapters.length} chapters
          </span>
        )}
      </div>
    </article>
  );
}
