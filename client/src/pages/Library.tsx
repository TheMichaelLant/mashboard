import { useParams } from 'react-router-dom';
import { Bookmark, Archive, Highlighter } from 'lucide-react';
import BookmarksTab from '../components/library/BookmarksTab';
import ArchivesTab from '../components/library/ArchivesTab';
import HighlightsTab from '../components/library/HighlightsTab';
import Tabs, { TabConfig } from '../components/Tabs';
import PageHeader from '../components/PageHeader';
import { SiteMap, LibraryRoute } from '@/types/SiteMapEnum';

const TABS: TabConfig<LibraryRoute>[] = [
  { value: SiteMap.LIBRARY.BOOKMARKS, to: SiteMap.LIBRARY.BOOKMARKS, icon: Bookmark, label: 'Bookmarks', Component: BookmarksTab },
  { value: SiteMap.LIBRARY.ARCHIVES, to: SiteMap.LIBRARY.ARCHIVES, icon: Archive, label: 'Archives', Component: ArchivesTab },
  { value: SiteMap.LIBRARY.HIGHLIGHTS, to: SiteMap.LIBRARY.HIGHLIGHTS, icon: Highlighter, label: 'Highlights', Component: HighlightsTab },
];

export default function Library() {
  const { tab } = useParams<{ tab?: string }>();
  const tabPath = `/library/${tab ?? 'bookmarks'}` as LibraryRoute;
  const activeTab: LibraryRoute = Object.values(SiteMap.LIBRARY).includes(tabPath)
    ? tabPath
    : SiteMap.LIBRARY.BOOKMARKS;

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <PageHeader title="Library" />
      <Tabs.Navigation tabs={TABS} activeTab={activeTab} />
      <Tabs.Content tabs={TABS} activeTab={activeTab} />
    </div>
  );
}
