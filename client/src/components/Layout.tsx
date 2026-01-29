import { Outlet, Link, useLocation } from 'react-router-dom';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { Rss, Bookmark, User, Compass } from 'lucide-react';
import FloatingToolbar from './FloatingToolbar';

const navItems = [
  { path: '/feed', icon: Rss, label: 'Feed', public: false },
  { path: '/discover', icon: Compass, label: 'Discover', public: false },
  { path: '/library', icon: Bookmark, label: 'Library', public: false },
  { path: '/settings', icon: User, label: 'Account', public: false },
];

export default function Layout() {
  const location = useLocation();
  const { user } = useUser();

  return (
    <div className="min-h-screen flex">
      {/* Left Sidebar - Vertical Navigation */}
      <aside className="fixed left-0 top-0 h-full w-20 flex flex-col items-center py-8 z-50">
        {/* User Profile */}
        <SignedIn>
          <div className="mb-8">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.fullName || 'User'}
                className="w-12 h-12 rounded-full object-cover border-2 border-ink-700"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-ink-700 flex items-center justify-center">
                <User size={24} className="text-ink-300" />
              </div>
            )}
          </div>
          {/* User name - vertical */}
          <div className="vertical-text text-ink-400 text-sm tracking-wider mb-auto">
            {user?.firstName} {user?.lastName}
          </div>
        </SignedIn>

        <SignedOut>
          <div className="mb-8">
            <div className="w-12 h-12 rounded-full bg-ink-700 flex items-center justify-center">
              <User size={24} className="text-ink-300" />
            </div>
          </div>
        </SignedOut>

        {/* Navigation Items */}
        <nav className="flex flex-col items-center space-y-2 mt-auto">
          <SignedIn>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`vertical-text py-4 px-2 text-sm tracking-wider transition-colors ${
                    isActive
                      ? 'text-gold-600'
                      : 'text-ink-400 hover:text-ink-200'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              to="/sign-in"
              onClick={() => (window as Window & { Clerk?: { signOut: () => void } }).Clerk?.signOut()}
              className="vertical-text py-4 px-2 text-sm tracking-wider text-ink-400 hover:text-ink-200 transition-colors"
            >
              Sign Out
            </Link>
          </SignedIn>

          <SignedOut>
            <Link
              to="/sign-in"
              className="vertical-text py-4 px-2 text-sm tracking-wider text-ink-400 hover:text-gold-600 transition-colors"
            >
              Sign In
            </Link>
          </SignedOut>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-20 min-h-screen">
        <Outlet />
      </main>

      {/* Floating Toolbar - Right Side */}
      <FloatingToolbar />
    </div>
  );
}
