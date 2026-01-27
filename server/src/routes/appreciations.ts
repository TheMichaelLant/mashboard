import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db, appreciations, posts } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

export const appreciationsRouter = Router();

// Appreciate a post
appreciationsRouter.post('/:postId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const postId = parseInt(req.params.postId);

    // Check if post exists
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if already appreciated
    const existing = await db.query.appreciations.findFirst({
      where: and(
        eq(appreciations.userId, req.userId!),
        eq(appreciations.postId, postId)
      ),
    });

    if (existing) {
      return res.status(400).json({ error: 'Already appreciated this post' });
    }

    await db.insert(appreciations).values({
      userId: req.userId!,
      postId,
    });

    // Get new count
    const count = await db.query.appreciations.findMany({
      where: eq(appreciations.postId, postId),
    });

    res.json({ success: true, count: count.length });
  } catch (error) {
    console.error('Error appreciating post:', error);
    res.status(500).json({ error: 'Failed to appreciate post' });
  }
});

// Remove appreciation
appreciationsRouter.delete('/:postId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const postId = parseInt(req.params.postId);

    await db.delete(appreciations)
      .where(and(
        eq(appreciations.userId, req.userId!),
        eq(appreciations.postId, postId)
      ));

    // Get new count
    const count = await db.query.appreciations.findMany({
      where: eq(appreciations.postId, postId),
    });

    res.json({ success: true, count: count.length });
  } catch (error) {
    console.error('Error removing appreciation:', error);
    res.status(500).json({ error: 'Failed to remove appreciation' });
  }
});

// Get user's appreciated posts
appreciationsRouter.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const userAppreciations = await db.query.appreciations.findMany({
      where: eq(appreciations.userId, userId),
      with: {
        post: {
          with: {
            author: true,
            categories: {
              with: {
                category: true,
              },
            },
          },
        },
      },
      orderBy: desc(appreciations.createdAt),
      limit: parseInt(limit as string),
      offset,
    });

    res.json(userAppreciations.map(a => a.post));
  } catch (error) {
    console.error('Error fetching appreciated posts:', error);
    res.status(500).json({ error: 'Failed to fetch appreciated posts' });
  }
});

// Get appreciation count for a post
appreciationsRouter.get('/count/:postId', async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);

    const count = await db.query.appreciations.findMany({
      where: eq(appreciations.postId, postId),
    });

    res.json({ count: count.length });
  } catch (error) {
    console.error('Error fetching appreciation count:', error);
    res.status(500).json({ error: 'Failed to fetch appreciation count' });
  }
});
