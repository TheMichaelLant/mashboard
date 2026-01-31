import type { Post, User, Category, Highlight, Subscription, SearchResults, CreatorSettings } from '../types';

const API_BASE = '/api';

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'An error occurred');
  }

  return response.json();
}

// Users
export const userApi = {
  getMe: () => fetchApi<User>('/users/me'),

  updateMe: (data: Partial<User>) =>
    fetchApi<User>('/users/me', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getByUsername: (username: string) =>
    fetchApi<User>(`/users/username/${username}`),

  getById: (id: string) => fetchApi<User>(`/users/${id}`),

  checkUsername: (username: string) =>
    fetchApi<{ available: boolean }>(`/users/check-username/${username}`),

  updateCreatorSettings: (data: Partial<CreatorSettings>) =>
    fetchApi<CreatorSettings>('/users/me/creator-settings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Posts
export const postApi = {
  getMyPosts: (params?: { type?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set('type', params.type);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    return fetchApi<Post[]>(`/posts?${searchParams}`);
  },

  getUserPosts: (userId: string, params?: { type?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set('type', params.type);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    return fetchApi<Post[]>(`/posts/user/${userId}?${searchParams}`);
  },

  getById: (id: number) => fetchApi<Post>(`/posts/${id}`),

  create: (data: {
    type: string;
    title?: string;
    content: string;
    excerpt?: string;
    isPaid?: boolean;
    categoryIds?: number[];
    chapters?: { title: string; content: string }[];
  }) =>
    fetchApi<Post>('/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (
    id: number,
    data: {
      title?: string;
      content?: string;
      excerpt?: string;
      isPaid?: boolean;
      categoryIds?: number[];
      chapters?: { title: string; content: string }[];
    }
  ) =>
    fetchApi<Post>(`/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    fetchApi<{ success: boolean }>(`/posts/${id}`, {
      method: 'DELETE',
    }),

  getSummary: (id: number) =>
    fetchApi<{ summary: string }>(`/posts/${id}/summary`, {
      method: 'POST',
    }),

  suggestHighlights: (id: number) =>
    fetchApi<{ suggestions: Array<{ text: string; reason: string }> }>(`/posts/${id}/suggest-highlights`, {
      method: 'POST',
    }),
};

// Categories
export const categoryApi = {
  getAll: (search?: string) => {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return fetchApi<Category[]>(`/categories${params}`);
  },

  getBySlug: (slug: string) => fetchApi<Category>(`/categories/slug/${slug}`),

  getPopular: () => fetchApi<Category[]>('/categories/popular/list'),

  create: (data: { name: string; description?: string }) =>
    fetchApi<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Follows
export const followApi = {
  follow: (userId: string) =>
    fetchApi<{ success: boolean }>(`/follows/${userId}`, {
      method: 'POST',
    }),

  unfollow: (userId: string) =>
    fetchApi<{ success: boolean }>(`/follows/${userId}`, {
      method: 'DELETE',
    }),

  getFollowers: (userId: string, page = 1, limit = 20) =>
    fetchApi<User[]>(`/follows/followers/${userId}?page=${page}&limit=${limit}`),

  getFollowing: (userId: string, page = 1, limit = 20) =>
    fetchApi<User[]>(`/follows/following/${userId}?page=${page}&limit=${limit}`),

  checkFollowing: (userId: string) =>
    fetchApi<{ isFollowing: boolean }>(`/follows/check/${userId}`),
};

// Appreciations
export const appreciationApi = {
  appreciate: (postId: number) =>
    fetchApi<{ success: boolean; count: number }>(`/appreciations/${postId}`, {
      method: 'POST',
    }),

  unappreciate: (postId: number) =>
    fetchApi<{ success: boolean; count: number }>(`/appreciations/${postId}`, {
      method: 'DELETE',
    }),

  getUserAppreciations: (userId: string, page = 1, limit = 20) =>
    fetchApi<Post[]>(`/appreciations/user/${userId}?page=${page}&limit=${limit}`),
};

// Bookmarks
export const bookmarkApi = {
  bookmark: (postId: number) =>
    fetchApi<{ success: boolean }>(`/bookmarks/${postId}`, {
      method: 'POST',
    }),

  unbookmark: (postId: number) =>
    fetchApi<{ success: boolean }>(`/bookmarks/${postId}`, {
      method: 'DELETE',
    }),

  archive: (bookId: number) =>
    fetchApi<{ success: boolean }>(`/bookmarks/archive/${bookId}`, {
      method: 'POST',
    }),

  unarchive: (bookId: number) =>
    fetchApi<{ success: boolean }>(`/bookmarks/archive/${bookId}`, {
      method: 'DELETE',
    }),

  getMyBookmarks: (page = 1, limit = 20) =>
    fetchApi<Post[]>(`/bookmarks/me?page=${page}&limit=${limit}`),

  getMyArchives: (page = 1, limit = 20) =>
    fetchApi<Post[]>(`/bookmarks/archives?page=${page}&limit=${limit}`),
};

// Highlights
export const highlightApi = {
  create: (data: {
    postId: number;
    chapterId?: number;
    selectedText: string;
    startOffset: number;
    endOffset: number;
    note?: string;
  }) =>
    fetchApi<Highlight>('/highlights', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, note: string) =>
    fetchApi<Highlight>(`/highlights/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ note }),
    }),

  delete: (id: number) =>
    fetchApi<{ success: boolean }>(`/highlights/${id}`, {
      method: 'DELETE',
    }),

  getMyHighlights: (page = 1, limit = 50) =>
    fetchApi<Highlight[]>(`/highlights/me?page=${page}&limit=${limit}`),

  getPostHighlights: (postId: number) =>
    fetchApi<Highlight[]>(`/highlights/post/${postId}`),

  summarize: (id: number) =>
    fetchApi<{ summary: string; cached: boolean }>(`/highlights/${id}/summarize`, {
      method: 'POST',
    }),
};

// Subscriptions
export const subscriptionApi = {
  subscribe: (creatorId: string) =>
    fetchApi<Subscription>(`/subscriptions/${creatorId}`, {
      method: 'POST',
    }),

  unsubscribe: (creatorId: string) =>
    fetchApi<{ success: boolean }>(`/subscriptions/${creatorId}`, {
      method: 'DELETE',
    }),

  getMySubscriptions: (status?: string, page = 1, limit = 20) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('page', page.toString());
    params.set('limit', limit.toString());
    return fetchApi<Subscription[]>(`/subscriptions/me?${params}`);
  },

  getMySubscribers: (page = 1, limit = 20) =>
    fetchApi<Subscription[]>(`/subscriptions/subscribers?page=${page}&limit=${limit}`),

  checkSubscription: (creatorId: string) =>
    fetchApi<{ isSubscribed: boolean; subscription?: Subscription }>(
      `/subscriptions/check/${creatorId}`
    ),
};

// Feed
export const feedApi = {
  getFeed: (params?: { type?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set('type', params.type);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    return fetchApi<Post[]>(`/feed?${searchParams}`);
  },

  getPersonalizedFeed: (page = 1, limit = 20) =>
    fetchApi<Post[]>(`/feed/personalized?page=${page}&limit=${limit}`),
};

// Discover
export const discoverApi = {
  search: (params: {
    q: string;
    type?: string;
    category?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    searchParams.set('q', params.q);
    if (params.type) searchParams.set('type', params.type);
    if (params.category) searchParams.set('category', params.category);
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    return fetchApi<SearchResults>(`/discover/search?${searchParams}`);
  },

  getTrending: (params?: { type?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set('type', params.type);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    return fetchApi<Post[]>(`/discover/trending?${searchParams}`);
  },

  getLatest: (params?: { type?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set('type', params.type);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    return fetchApi<Post[]>(`/discover/latest?${searchParams}`);
  },

  getByCategory: (slug: string, params?: { type?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set('type', params.type);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    return fetchApi<{ category: Category; posts: Post[] }>(
      `/discover/category/${slug}?${searchParams}`
    );
  },

  getWriters: (page = 1, limit = 20) =>
    fetchApi<User[]>(`/discover/writers?page=${page}&limit=${limit}`),
};
