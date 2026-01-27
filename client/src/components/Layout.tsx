import { Outlet, Link, useLocation } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import {
  Home,
  Compass,
  PenTool,
  Rss,
  Library,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/', icon: Home, label: 'Home', public: true },
  { path: '/discover', icon: Compass, label: 'Discover', public: true },
  { path: '/feed', icon: Rss, label: 'Feed', public: false },
  { path: '/write', icon: PenTool, label: 'Write', public: false },
  { path: '/library', icon: Library, label: 'Library', public: false },
  { path: '/settings', icon: Settings, label: 'Settings', public: false },
];

export default function Layout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-paper-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-paper-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-2xl font-display font-bold text-ink-900">
                Mashboard
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              <SignedIn>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-ink-900 text-paper-50'
                          : 'text-ink-600 hover:bg-paper-100'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </SignedIn>
              <SignedOut>
                {navItems
                  .filter((item) => item.public)
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-ink-900 text-paper-50'
                            : 'text-ink-600 hover:bg-paper-100'
                        }`}
                      >
                        <Icon size={18} />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
              </SignedOut>
            </nav>

            {/* Auth Section */}
            <div className="flex items-center space-x-4">
              <SignedIn>
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: 'w-10 h-10',
                    },
                  }}
                />
              </SignedIn>
              <SignedOut>
                <Link to="/sign-in" className="btn btn-ghost btn-sm">
                  Sign In
                </Link>
                <Link to="/sign-up" className="btn btn-primary btn-sm">
                  Get Started
                </Link>
              </SignedOut>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-paper-100"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-paper-100">
            <nav className="px-4 py-2 space-y-1">
              <SignedIn>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-ink-900 text-paper-50'
                          : 'text-ink-600 hover:bg-paper-100'
                      }`}
                    >
                      <Icon size={20} />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </SignedIn>
              <SignedOut>
                {navItems
                  .filter((item) => item.public)
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-ink-900 text-paper-50'
                            : 'text-ink-600 hover:bg-paper-100'
                        }`}
                      >
                        <Icon size={20} />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
              </SignedOut>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-paper-100 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2">
              <span className="font-display font-bold text-ink-700">
                Mashboard
              </span>
              <span className="text-ink-400">
                &copy; {new Date().getFullYear()}
              </span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-ink-500">
              <Link to="/about" className="hover:text-ink-700">
                About
              </Link>
              <Link to="/terms" className="hover:text-ink-700">
                Terms
              </Link>
              <Link to="/privacy" className="hover:text-ink-700">
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
