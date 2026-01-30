import { Bookmark, Trash2 } from 'lucide-react';
import PostCard from '../PostCard';
import LibraryEmptyState from './LibraryEmptyState';
import LibraryLoadingSkeleton from './LibraryLoadingSkeleton';
import { useBookmarks } from '../../hooks/useBookmarks';

export default function BookmarksTab() {
  const { bookmarks, loading, removeBookmark, toggleAppreciation } = useBookmarks();

  if (loading) {
    return <LibraryLoadingSkeleton />;
  }

  if (bookmarks.length === 0) {
    return (
      <LibraryEmptyState
        icon={Bookmark}
        title="No bookmarks yet"
        description="When you bookmark posts, they'll appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {bookmarks.map((post) => (
        <div key={post.id} className="relative">
          <PostCard
            post={post}
            variant="list"
            onAppreciate={toggleAppreciation}
            onBookmark={() => removeBookmark(post.id)}
          />
          <button
            onClick={() => removeBookmark(post.id)}
            className="absolute top-4 right-4 p-2 rounded-lg bg-ink-800 hover:bg-red-900/50 text-ink-400 hover:text-red-400 transition-colors"
            title="Remove bookmark"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
