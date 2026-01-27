import { Router } from 'express';
import { eq, desc, inArray, and } from 'drizzle-orm';
import { db, posts, follows, subscriptions } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

export const feedRouter = Router();

// Get user's feed (posts from followed users)
feedRouter.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { page = '1', limit = '20', type } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Get list of users being followed
    const following = await db.query.follows.findMany({
      where: eq(follows.followerId, req.userId!),
    });

    const followingIds = following.map(f => f.followingId);

    if (followingIds.length === 0) {
      return res.json([]);
    }

    // Get active subscriptions
    const activeSubscriptions = await db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.subscriberId, req.userId!),
        eq(subscriptions.status, 'active')
      ),
    });

    const subscribedCreatorIds = activeSubscriptions.map(s => s.creatorId);

    // Get posts from followed users
    const feedPosts = await db.query.posts.findMany({
      where: type
        ? and(
            inArray(posts.authorId, followingIds),
            eq(posts.type, type as 'line' | 'page' | 'book')
          )
        : inArray(posts.authorId, followingIds),
      with: {
        author: true,
        categories: {
          with: {
            category: true,
          },
        },
        appreciations: true,
        chapters: true,
      },
      orderBy: desc(posts.createdAt),
      limit: parseInt(limit as string),
      offset,
    });

    // Filter paid content and add counts
    const processedPosts = feedPosts.map(post => {
      const hasAccess = !post.isPaid || subscribedCreatorIds.includes(post.authorId);

      if (!hasAccess) {
        return {
          ...post,
          content: null,
          chapters: [],
          excerpt: post.excerpt || 'This is paid content. Subscribe to view.',
          isLocked: true,
          appreciationCount: post.appreciations.length,
        };
      }

      return {
        ...post,
        isLocked: false,
        appreciationCount: post.appreciations.length,
      };
    });

    res.json(processedPosts);
  } catch (error) {
    console.error('Error fetching feed:', error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// Get personalized feed (mix of followed users and trending)
feedRouter.get('/personalized', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Get followed users
    const following = await db.query.follows.findMany({
      where: eq(follows.followerId, req.userId!),
    });

    const followingIds = following.map(f => f.followingId);

    // Get posts - mix of followed and trending
    let feedPosts;
    if (followingIds.length > 0) {
      feedPosts = await db.query.posts.findMany({
        with: {
          author: true,
          categories: {
            with: {
              category: true,
            },
          },
          appreciations: true,
        },
        orderBy: desc(posts.createdAt),
        limit: parseInt(limit as string) * 2,
        offset,
      });

      // Prioritize followed users' posts
      feedPosts.sort((a, b) => {
        const aFollowed = followingIds.includes(a.authorId);
        const bFollowed = followingIds.includes(b.authorId);
        if (aFollowed && !bFollowed) return -1;
        if (!aFollowed && bFollowed) return 1;
        return b.appreciations.length - a.appreciations.length;
      });

      feedPosts = feedPosts.slice(0, parseInt(limit as string));
    } else {
      // No followed users, show trending
      feedPosts = await db.query.posts.findMany({
        with: {
          author: true,
          categories: {
            with: {
              category: true,
            },
          },
          appreciations: true,
        },
        orderBy: desc(posts.createdAt),
        limit: parseInt(limit as string),
        offset,
      });
    }

    // Get active subscriptions
    const activeSubscriptions = await db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.subscriberId, req.userId!),
        eq(subscriptions.status, 'active')
      ),
    });

    const subscribedCreatorIds = activeSubscriptions.map(s => s.creatorId);

    // Process posts
    const processedPosts = feedPosts.map(post => {
      const hasAccess = !post.isPaid || subscribedCreatorIds.includes(post.authorId);

      if (!hasAccess) {
        return {
          ...post,
          content: null,
          excerpt: post.excerpt || 'This is paid content. Subscribe to view.',
          isLocked: true,
          appreciationCount: post.appreciations.length,
        };
      }

      return {
        ...post,
        isLocked: false,
        appreciationCount: post.appreciations.length,
      };
    });

    res.json(processedPosts);
  } catch (error) {
    console.error('Error fetching personalized feed:', error);
    res.status(500).json({ error: 'Failed to fetch personalized feed' });
  }
});
