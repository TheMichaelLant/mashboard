import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import OpenAI from 'openai';
import { db, highlights, posts } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

// Lazy-initialize OpenAI client to ensure env vars are loaded
let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

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

// Generate AI summary for a highlight
highlightsRouter.post('/:id/summarize', requireAuth, async (req: AuthRequest, res) => {
  try {
    const highlightId = parseInt(req.params.id);

    // Find the highlight
    const highlight = await db.query.highlights.findFirst({
      where: eq(highlights.id, highlightId),
      with: {
        post: true,
      },
    });

    if (!highlight) {
      return res.status(404).json({ error: 'Highlight not found' });
    }

    if (highlight.userId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Return cached summary if available
    if (highlight.summary) {
      return res.json({ summary: highlight.summary, cached: true });
    }

    // Get surrounding context from the post
    const postContent = highlight.post?.content?.replace(/<[^>]*>/g, '') || '';
    const highlightText = highlight.selectedText;

    // Find the highlight in context
    const highlightIndex = postContent.indexOf(highlightText);
    let context = '';
    if (highlightIndex !== -1) {
      const contextStart = Math.max(0, highlightIndex - 200);
      const contextEnd = Math.min(postContent.length, highlightIndex + highlightText.length + 200);
      context = postContent.slice(contextStart, contextEnd);
    }

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that provides brief insights about highlighted text.
Given a highlighted passage and its surrounding context, provide a 1-2 sentence summary or insight.
Focus on why this passage might be noteworthy, its key meaning, or how it relates to the broader context.
Keep your response concise and insightful.`,
        },
        {
          role: 'user',
          content: context
            ? `Highlighted passage: "${highlightText}"\n\nContext: "${context}"\n\nProvide a brief insight about this highlighted passage.`
            : `Highlighted passage: "${highlightText}"\n\nProvide a brief insight about this highlighted passage.`,
        },
      ],
      max_tokens: 150,
      temperature: 0.5,
    });

    const summary = completion.choices[0]?.message?.content || 'Unable to generate summary';

    // Cache the summary in the database
    await db.update(highlights)
      .set({ summary })
      .where(eq(highlights.id, highlightId));

    res.json({ summary, cached: false });
  } catch (error) {
    console.error('Error generating highlight summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});
