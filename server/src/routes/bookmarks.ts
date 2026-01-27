import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db, bookmarks, archives, posts } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

export const bookmarksRouter = Router();

// Bookmark a page/line
bookmarksRouter.post('/:postId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const postId = parseInt(req.params.postId);

    // Check if post exists
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if already bookmarked
    const existing = await db.query.bookmarks.findFirst({
      where: and(
        eq(bookmarks.userId, req.userId!),
        eq(bookmarks.postId, postId)
      ),
    });

    if (existing) {
      return res.status(400).json({ error: 'Already bookmarked this post' });
    }

    await db.insert(bookmarks).values({
      userId: req.userId!,
      postId,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error bookmarking post:', error);
    res.status(500).json({ error: 'Failed to bookmark post' });
  }
});

// Remove bookmark
bookmarksRouter.delete('/:postId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const postId = parseInt(req.params.postId);

    await db.delete(bookmarks)
      .where(and(
        eq(bookmarks.userId, req.userId!),
        eq(bookmarks.postId, postId)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing bookmark:', error);
    res.status(500).json({ error: 'Failed to remove bookmark' });
  }
});

// Archive a book
bookmarksRouter.post('/archive/:bookId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookId = parseInt(req.params.bookId);

    // Check if book exists and is a book type
    const book = await db.query.posts.findFirst({
      where: and(eq(posts.id, bookId), eq(posts.type, 'book')),
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Check if already archived
    const existing = await db.query.archives.findFirst({
      where: and(
        eq(archives.userId, req.userId!),
        eq(archives.bookId, bookId)
      ),
    });

    if (existing) {
      return res.status(400).json({ error: 'Already archived this book' });
    }

    await db.insert(archives).values({
      userId: req.userId!,
      bookId,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error archiving book:', error);
    res.status(500).json({ error: 'Failed to archive book' });
  }
});

// Remove archive
bookmarksRouter.delete('/archive/:bookId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookId = parseInt(req.params.bookId);

    await db.delete(archives)
      .where(and(
        eq(archives.userId, req.userId!),
        eq(archives.bookId, bookId)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing archive:', error);
    res.status(500).json({ error: 'Failed to remove archive' });
  }
});

// Get user's bookmarks
bookmarksRouter.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const userBookmarks = await db.query.bookmarks.findMany({
      where: eq(bookmarks.userId, req.userId!),
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
      orderBy: desc(bookmarks.createdAt),
      limit: parseInt(limit as string),
      offset,
    });

    res.json(userBookmarks.map(b => ({ ...b.post, bookmarkedAt: b.createdAt })));
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
});

// Get user's archives
bookmarksRouter.get('/archives', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const userArchives = await db.query.archives.findMany({
      where: eq(archives.userId, req.userId!),
      with: {
        book: {
          with: {
            author: true,
            chapters: true,
            categories: {
              with: {
                category: true,
              },
            },
          },
        },
      },
      orderBy: desc(archives.createdAt),
      limit: parseInt(limit as string),
      offset,
    });

    res.json(userArchives.map(a => ({ ...a.book, archivedAt: a.createdAt })));
  } catch (error) {
    console.error('Error fetching archives:', error);
    res.status(500).json({ error: 'Failed to fetch archives' });
  }
});
