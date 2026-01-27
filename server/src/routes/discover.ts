import { Router } from 'express';
import { eq, desc, like, or, and } from 'drizzle-orm';
import { db, posts, users, categories, postCategories, subscriptions } from '../db/index.js';
import { optionalAuth, AuthRequest } from '../middleware/auth.js';

export const discoverRouter = Router();

// Search posts and users
discoverRouter.get('/search', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { q, type, category, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchTerm = `%${q}%`;

    // Search posts
    let searchPosts = await db.query.posts.findMany({
      where: type
        ? and(
            or(
              like(posts.title, searchTerm),
              like(posts.excerpt, searchTerm)
            ),
            eq(posts.type, type as 'line' | 'page' | 'book')
          )
        : or(
            like(posts.title, searchTerm),
            like(posts.excerpt, searchTerm)
          ),
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

    // Filter by category if specified
    if (category) {
      searchPosts = searchPosts.filter(post =>
        post.categories.some(pc => pc.category.slug === category)
      );
    }

    // Get user subscriptions if authenticated
    let subscribedCreatorIds: string[] = [];
    if (req.userId) {
      const activeSubscriptions = await db.query.subscriptions.findMany({
        where: and(
          eq(subscriptions.subscriberId, req.userId),
          eq(subscriptions.status, 'active')
        ),
      });
      subscribedCreatorIds = activeSubscriptions.map(s => s.creatorId);
    }

    // Process posts
    const processedPosts = searchPosts.map(post => {
      const hasAccess = !post.isPaid ||
        (req.userId && (req.userId === post.authorId || subscribedCreatorIds.includes(post.authorId)));

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

    // Search users
    const searchUsers = await db.query.users.findMany({
      where: or(
        like(users.username, searchTerm),
        like(users.displayName, searchTerm)
      ),
      limit: 10,
    });

    res.json({
      posts: processedPosts,
      users: searchUsers,
    });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// Get trending posts
discoverRouter.get('/trending', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { type, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const trendingPosts = await db.query.posts.findMany({
      where: type
        ? eq(posts.type, type as 'line' | 'page' | 'book')
        : undefined,
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

    // Sort by appreciation count (trending)
    const sorted = trendingPosts
      .sort((a, b) => b.appreciations.length - a.appreciations.length)
      .slice(0, parseInt(limit as string));

    // Get user subscriptions if authenticated
    let subscribedCreatorIds: string[] = [];
    if (req.userId) {
      const activeSubscriptions = await db.query.subscriptions.findMany({
        where: and(
          eq(subscriptions.subscriberId, req.userId),
          eq(subscriptions.status, 'active')
        ),
      });
      subscribedCreatorIds = activeSubscriptions.map(s => s.creatorId);
    }

    // Process posts
    const processedPosts = sorted.map(post => {
      const hasAccess = !post.isPaid ||
        (req.userId && (req.userId === post.authorId || subscribedCreatorIds.includes(post.authorId)));

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
    console.error('Error fetching trending:', error);
    res.status(500).json({ error: 'Failed to fetch trending' });
  }
});

// Get latest posts
discoverRouter.get('/latest', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { type, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const latestPosts = await db.query.posts.findMany({
      where: type
        ? eq(posts.type, type as 'line' | 'page' | 'book')
        : undefined,
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

    // Get user subscriptions if authenticated
    let subscribedCreatorIds: string[] = [];
    if (req.userId) {
      const activeSubscriptions = await db.query.subscriptions.findMany({
        where: and(
          eq(subscriptions.subscriberId, req.userId),
          eq(subscriptions.status, 'active')
        ),
      });
      subscribedCreatorIds = activeSubscriptions.map(s => s.creatorId);
    }

    // Process posts
    const processedPosts = latestPosts.map(post => {
      const hasAccess = !post.isPaid ||
        (req.userId && (req.userId === post.authorId || subscribedCreatorIds.includes(post.authorId)));

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
    console.error('Error fetching latest:', error);
    res.status(500).json({ error: 'Failed to fetch latest' });
  }
});

// Get posts by category
discoverRouter.get('/category/:slug', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { slug } = req.params;
    const { type, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const category = await db.query.categories.findFirst({
      where: eq(categories.slug, slug),
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const categoryPosts = await db.query.postCategories.findMany({
      where: eq(postCategories.categoryId, category.id),
      with: {
        post: {
          with: {
            author: true,
            categories: {
              with: {
                category: true,
              },
            },
            appreciations: true,
          },
        },
      },
    });

    let filteredPosts = categoryPosts.map(cp => cp.post);

    // Filter by type if specified
    if (type) {
      filteredPosts = filteredPosts.filter(post => post.type === type);
    }

    // Sort and paginate
    filteredPosts = filteredPosts
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(offset, offset + parseInt(limit as string));

    // Get user subscriptions if authenticated
    let subscribedCreatorIds: string[] = [];
    if (req.userId) {
      const activeSubscriptions = await db.query.subscriptions.findMany({
        where: and(
          eq(subscriptions.subscriberId, req.userId),
          eq(subscriptions.status, 'active')
        ),
      });
      subscribedCreatorIds = activeSubscriptions.map(s => s.creatorId);
    }

    // Process posts
    const processedPosts = filteredPosts.map(post => {
      const hasAccess = !post.isPaid ||
        (req.userId && (req.userId === post.authorId || subscribedCreatorIds.includes(post.authorId)));

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

    res.json({
      category,
      posts: processedPosts,
    });
  } catch (error) {
    console.error('Error fetching category posts:', error);
    res.status(500).json({ error: 'Failed to fetch category posts' });
  }
});

// Get featured writers
discoverRouter.get('/writers', async (req, res) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const allUsers = await db.query.users.findMany({
      with: {
        posts: {
          with: {
            appreciations: true,
          },
        },
        followers: true,
      },
    });

    // Sort by total appreciations
    const sortedUsers = allUsers
      .map(user => ({
        ...user,
        totalAppreciations: user.posts.reduce((sum, post) => sum + post.appreciations.length, 0),
        followerCount: user.followers.length,
        postCount: user.posts.length,
      }))
      .sort((a, b) => b.totalAppreciations - a.totalAppreciations)
      .slice(offset, offset + parseInt(limit as string));

    // Remove nested data for cleaner response
    const cleanedUsers = sortedUsers.map(({ posts, followers, ...user }) => user);

    res.json(cleanedUsers);
  } catch (error) {
    console.error('Error fetching writers:', error);
    res.status(500).json({ error: 'Failed to fetch writers' });
  }
});
