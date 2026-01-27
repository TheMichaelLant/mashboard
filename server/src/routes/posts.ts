import { Router } from 'express';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { db, posts, chapters, postCategories, categories, appreciations, bookmarks, archives, subscriptions } from '../db/index.js';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth.js';

export const postsRouter = Router();

// Get all posts by user (public profile)
postsRouter.get('/user/:userId', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const { type, page = '1', limit = '20' } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Check if current user is subscribed to this author
    let isSubscribed = false;
    if (req.userId && req.userId !== userId) {
      const subscription = await db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.subscriberId, req.userId),
          eq(subscriptions.creatorId, userId),
          eq(subscriptions.status, 'active')
        ),
      });
      isSubscribed = !!subscription;
    }

    const userPosts = await db.query.posts.findMany({
      where: type
        ? and(eq(posts.authorId, userId), eq(posts.type, type as 'line' | 'page' | 'book'))
        : eq(posts.authorId, userId),
      with: {
        author: true,
        categories: {
          with: {
            category: true,
          },
        },
        chapters: type === 'book' ? true : undefined,
      },
      orderBy: desc(posts.createdAt),
      limit: parseInt(limit as string),
      offset,
    });

    // Filter paid content if not subscribed and not the author
    const filteredPosts = userPosts.map(post => {
      if (post.isPaid && req.userId !== userId && !isSubscribed) {
        return {
          ...post,
          content: null,
          excerpt: post.excerpt || 'This is paid content. Subscribe to view.',
          isLocked: true,
        };
      }
      return { ...post, isLocked: false };
    });

    res.json(filteredPosts);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get single post
postsRouter.get('/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const postId = parseInt(req.params.id);

    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
      with: {
        author: true,
        categories: {
          with: {
            category: true,
          },
        },
        chapters: {
          orderBy: (chapters, { asc }) => asc(chapters.orderIndex),
        },
        appreciations: true,
        bookmarks: true,
      },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user has access to paid content
    let hasAccess = !post.isPaid || post.authorId === req.userId;

    if (post.isPaid && req.userId && req.userId !== post.authorId) {
      const subscription = await db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.subscriberId, req.userId),
          eq(subscriptions.creatorId, post.authorId),
          eq(subscriptions.status, 'active')
        ),
      });
      hasAccess = !!subscription;
    }

    // Check if user appreciated/bookmarked
    let isAppreciated = false;
    let isBookmarked = false;
    let isArchived = false;

    if (req.userId) {
      const appreciation = await db.query.appreciations.findFirst({
        where: and(
          eq(appreciations.userId, req.userId),
          eq(appreciations.postId, postId)
        ),
      });
      isAppreciated = !!appreciation;

      const bookmark = await db.query.bookmarks.findFirst({
        where: and(
          eq(bookmarks.userId, req.userId),
          eq(bookmarks.postId, postId)
        ),
      });
      isBookmarked = !!bookmark;

      if (post.type === 'book') {
        const archive = await db.query.archives.findFirst({
          where: and(
            eq(archives.userId, req.userId),
            eq(archives.bookId, postId)
          ),
        });
        isArchived = !!archive;
      }
    }

    if (!hasAccess) {
      return res.json({
        ...post,
        content: null,
        chapters: [],
        excerpt: post.excerpt || 'This is paid content. Subscribe to view.',
        isLocked: true,
        appreciationCount: post.appreciations.length,
        bookmarkCount: post.bookmarks.length,
        isAppreciated,
        isBookmarked,
        isArchived,
      });
    }

    res.json({
      ...post,
      isLocked: false,
      appreciationCount: post.appreciations.length,
      bookmarkCount: post.bookmarks.length,
      isAppreciated,
      isBookmarked,
      isArchived,
    });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Create post
postsRouter.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { type, title, content, excerpt, isPaid, categoryIds, chapters: chapterData } = req.body;

    const [newPost] = await db.insert(posts).values({
      authorId: req.userId!,
      type,
      title,
      content: type === 'book' ? JSON.stringify({ description: content }) : content,
      excerpt,
      isPaid: isPaid || false,
      publishedAt: new Date(),
    }).returning();

    // Add categories
    if (categoryIds && categoryIds.length > 0) {
      await db.insert(postCategories).values(
        categoryIds.map((categoryId: number) => ({
          postId: newPost.id,
          categoryId,
        }))
      );
    }

    // Add chapters for books
    if (type === 'book' && chapterData && chapterData.length > 0) {
      await db.insert(chapters).values(
        chapterData.map((chapter: { title: string; content: string }, index: number) => ({
          bookId: newPost.id,
          title: chapter.title,
          content: chapter.content,
          orderIndex: index,
        }))
      );
    }

    const createdPost = await db.query.posts.findFirst({
      where: eq(posts.id, newPost.id),
      with: {
        author: true,
        categories: {
          with: {
            category: true,
          },
        },
        chapters: true,
      },
    });

    res.status(201).json(createdPost);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Update post
postsRouter.put('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const postId = parseInt(req.params.id);
    const { title, content, excerpt, isPaid, categoryIds, chapters: chapterData } = req.body;

    // Check ownership
    const existingPost = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
    });

    if (!existingPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (existingPost.authorId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await db.update(posts)
      .set({
        title,
        content: existingPost.type === 'book' ? JSON.stringify({ description: content }) : content,
        excerpt,
        isPaid,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, postId));

    // Update categories
    if (categoryIds) {
      await db.delete(postCategories).where(eq(postCategories.postId, postId));
      if (categoryIds.length > 0) {
        await db.insert(postCategories).values(
          categoryIds.map((categoryId: number) => ({
            postId,
            categoryId,
          }))
        );
      }
    }

    // Update chapters for books
    if (existingPost.type === 'book' && chapterData) {
      await db.delete(chapters).where(eq(chapters.bookId, postId));
      if (chapterData.length > 0) {
        await db.insert(chapters).values(
          chapterData.map((chapter: { title: string; content: string }, index: number) => ({
            bookId: postId,
            title: chapter.title,
            content: chapter.content,
            orderIndex: index,
          }))
        );
      }
    }

    const updatedPost = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
      with: {
        author: true,
        categories: {
          with: {
            category: true,
          },
        },
        chapters: true,
      },
    });

    res.json(updatedPost);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete post
postsRouter.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const postId = parseInt(req.params.id);

    // Check ownership
    const existingPost = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
    });

    if (!existingPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (existingPost.authorId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await db.delete(posts).where(eq(posts.id, postId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Get current user's posts
postsRouter.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { type, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const userPosts = await db.query.posts.findMany({
      where: type
        ? and(eq(posts.authorId, req.userId!), eq(posts.type, type as 'line' | 'page' | 'book'))
        : eq(posts.authorId, req.userId!),
      with: {
        author: true,
        categories: {
          with: {
            category: true,
          },
        },
        chapters: true,
        appreciations: true,
      },
      orderBy: desc(posts.createdAt),
      limit: parseInt(limit as string),
      offset,
    });

    const postsWithCounts = userPosts.map(post => ({
      ...post,
      appreciationCount: post.appreciations.length,
    }));

    res.json(postsWithCounts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});
