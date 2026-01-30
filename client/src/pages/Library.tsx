import { Link, useParams } from 'react-router-dom';
import { Bookmark, Archive, Highlighter } from 'lucide-react';
import BookmarksTab from '../components/library/BookmarksTab';
import ArchivesTab from '../components/library/ArchivesTab';
import HighlightsTab from '../components/library/HighlightsTab';

type Tab = 'bookmarks' | 'archives' | 'highlights';

export default function Library() {
  const { tab } = useParams<{ tab?: string }>();
  const activeTab: Tab = (tab === 'archives' || tab === 'highlights') ? tab : 'bookmarks';

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-display font-bold text-ink-100">Library</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 border-b border-ink-700 mb-8">
        <TabButton
          active={activeTab === 'bookmarks'}
          to="/library"
          icon={Bookmark}
          label="Bookmarks"
        />
        <TabButton
          active={activeTab === 'archives'}
          to="/library/archives"
          icon={Archive}
          label="Archives"
        />
        <TabButton
          active={activeTab === 'highlights'}
          to="/library/highlights"
          icon={Highlighter}
          label="Highlights"
        />
      </div>

      {/* Content */}
      {activeTab === 'highlights' ? (
        <HighlightsTab />
      ) : activeTab === 'archives' ? (
        <ArchivesTab />
      ) : (
        <BookmarksTab />
      )}
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  to: string;
  icon: React.ElementType;
  label: string;
}

function TabButton({ active, to, icon: Icon, label }: TabButtonProps) {
  return (
    <Link
      to={to}
      className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
        active
          ? 'border-gold-600 text-gold-600'
          : 'border-transparent text-ink-400 hover:text-ink-200'
      }`}
    >
      <Icon size={18} />
      <span className="font-medium">{label}</span>
    </Link>
  );
}
