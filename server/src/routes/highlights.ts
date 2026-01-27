import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db, highlights, posts } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

export const highlightsRouter = Router();

// Create highlight
highlightsRouter.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { postId, chapterId, selectedText, startOffset, endOffset, note } = req.body;

    // Check if post exists
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const [newHighlight] = await db.insert(highlights).values({
      userId: req.userId!,
      postId,
      chapterId: chapterId || null,
      selectedText,
      startOffset,
      endOffset,
      note: note || null,
    }).returning();

    res.status(201).json(newHighlight);
  } catch (error) {
    console.error('Error creating highlight:', error);
    res.status(500).json({ error: 'Failed to create highlight' });
  }
});

// Update highlight note
highlightsRouter.put('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const highlightId = parseInt(req.params.id);
    const { note } = req.body;

    // Check ownership
    const existing = await db.query.highlights.findFirst({
      where: eq(highlights.id, highlightId),
    });

    if (!existing) {
      return res.status(404).json({ error: 'Highlight not found' });
    }

    if (existing.userId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await db.update(highlights)
      .set({ note })
      .where(eq(highlights.id, highlightId));

    const updated = await db.query.highlights.findFirst({
      where: eq(highlights.id, highlightId),
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating highlight:', error);
    res.status(500).json({ error: 'Failed to update highlight' });
  }
});

// Delete highlight
highlightsRouter.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const highlightId = parseInt(req.params.id);

    // Check ownership
    const existing = await db.query.highlights.findFirst({
      where: eq(highlights.id, highlightId),
    });

    if (!existing) {
      return res.status(404).json({ error: 'Highlight not found' });
    }

    if (existing.userId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await db.delete(highlights).where(eq(highlights.id, highlightId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting highlight:', error);
    res.status(500).json({ error: 'Failed to delete highlight' });
  }
});

// Get user's highlights
highlightsRouter.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const userHighlights = await db.query.highlights.findMany({
      where: eq(highlights.userId, req.userId!),
      with: {
        post: {
          with: {
            author: true,
          },
        },
        chapter: true,
      },
      orderBy: desc(highlights.createdAt),
      limit: parseInt(limit as string),
      offset,
    });

    res.json(userHighlights);
  } catch (error) {
    console.error('Error fetching highlights:', error);
    res.status(500).json({ error: 'Failed to fetch highlights' });
  }
});

// Get highlights for a specific post
highlightsRouter.get('/post/:postId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const postId = parseInt(req.params.postId);

    const postHighlights = await db.query.highlights.findMany({
      where: and(
        eq(highlights.userId, req.userId!),
        eq(highlights.postId, postId)
      ),
      orderBy: (highlights) => highlights.startOffset,
    });

    res.json(postHighlights);
  } catch (error) {
    console.error('Error fetching post highlights:', error);
    res.status(500).json({ error: 'Failed to fetch post highlights' });
  }
});
