export type PostType = 'line' | 'page' | 'book';

export interface User {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
  isFollowing?: boolean;
  creatorSettings?: CreatorSettings;
}

export interface CreatorSettings {
  userId: string;
  subscriptionPrice: number;
  acceptsSubscriptions: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  createdAt: Date;
  postCount?: number;
}

export interface Chapter {
  id: number;
  bookId: number;
  title: string;
  content: string;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Post {
  id: number;
  authorId: string;
  type: PostType;
  title?: string;
  content: string;
  excerpt?: string;
  isPaid: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  author?: User;
  chapters?: Chapter[];
  categories?: { category: Category }[];
  appreciationCount?: number;
  bookmarkCount?: number;
  isAppreciated?: boolean;
  isBookmarked?: boolean;
  isArchived?: boolean;
  isLocked?: boolean;
}

export interface Highlight {
  id: number;
  userId: string;
  postId: number;
  chapterId?: number;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  note?: string;
  createdAt: Date;
  post?: Post;
  chapter?: Chapter;
}

export interface Subscription {
  id: number;
  subscriberId: string;
  creatorId: string;
  status: 'active' | 'cancelled' | 'expired';
  price: number;
  startedAt: Date;
  expiresAt?: Date;
  createdAt: Date;
  creator?: User;
  subscriber?: User;
}

export interface SearchResults {
  posts: Post[];
  users: User[];
}

export interface ApiError {
  error: string;
}
