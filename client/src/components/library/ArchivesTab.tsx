import { Archive, Trash2 } from 'lucide-react';
import PostCard from '../PostCard';
import { IconButton } from '../ui';
import LibraryEmptyState from './LibraryEmptyState';
import LibraryLoadingSkeleton from './LibraryLoadingSkeleton';
import { useArchives } from '../../hooks/useArchives';

export default function ArchivesTab() {
  const { archives, loading, removeArchive, toggleAppreciation } = useArchives();

  if (loading) {
    return <LibraryLoadingSkeleton />;
  }

  if (archives.length === 0) {
    return (
      <LibraryEmptyState
        icon={Archive}
        title="No archived books"
        description="When you archive books, they'll appear here for easy access."
      />
    );
  }

  return (
    <div className="space-y-4">
      {archives.map((book) => (
        <div key={book.id} className="relative">
          <PostCard
            post={book}
            variant="list"
            onAppreciate={toggleAppreciation}
            onBookmark={() => removeArchive(book.id)}
          />
          <IconButton
            icon={Trash2}
            variant="danger"
            size="sm"
            label="Remove from archives"
            onClick={() => removeArchive(book.id)}
            className="absolute top-4 right-4"
          />
        </div>
      ))}
    </div>
  );
}
