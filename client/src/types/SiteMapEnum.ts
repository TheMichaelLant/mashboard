export const SiteMap = {
  HOME: '/',
  DISCOVER: '/discover',
  PROFILE: '/:handle',
  FEED: '/feed',
  WRITE: '/write',
  LIBRARY: {
    ROOT: '/library',
    BOOKMARKS: '/library/bookmarks',
    ARCHIVES: '/library/archives',
    HIGHLIGHTS: '/library/highlights',
  },
  SETTINGS: {
    ROOT: '/settings',
    PROFILE: '/settings/profile',
    SUBSCRIPTIONS: '/settings/subscriptions',
    CREATOR: '/settings/creator',
  },
} as const;

// Type helpers
export type LibraryRoute = typeof SiteMap.LIBRARY[keyof typeof SiteMap.LIBRARY];
export type SettingsRoute = typeof SiteMap.SETTINGS[keyof typeof SiteMap.SETTINGS];
