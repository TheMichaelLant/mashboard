import { Router } from 'express';
import { eq, desc, and, inArray } from 'drizzle-orm';
import OpenAI from 'openai';
import { db, posts, chapters, postCategories, categories, appreciations, bookmarks, archives, subscriptions } from '../db/index.js';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth.js';

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

// Get AI summary of a post
postsRouter.post('/:id/summary', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const postId = parseInt(req.params.id);

    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
      with: {
        chapters: true,
      },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check access for paid content
    if (post.isPaid && req.userId !== post.authorId) {
      const subscription = await db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.subscriberId, req.userId!),
          eq(subscriptions.creatorId, post.authorId),
          eq(subscriptions.status, 'active')
        ),
      });
      if (!subscription) {
        return res.status(403).json({ error: 'Subscribe to access this content' });
      }
    }

    // Extract text content (strip HTML tags)
    let textContent = '';
    if (post.type === 'book' && post.chapters && post.chapters.length > 0) {
      textContent = post.chapters
        .map(ch => `${ch.title}\n${ch.content?.replace(/<[^>]*>/g, '') || ''}`)
        .join('\n\n');
    } else {
      textContent = post.content?.replace(/<[^>]*>/g, '') || '';
    }

    if (!textContent.trim()) {
      return res.status(400).json({ error: 'No content to summarize' });
    }

    // Truncate to avoid token limits (roughly 4 chars per token, ~8000 tokens max input)
    const maxChars = 30000;
    if (textContent.length > maxChars) {
      textContent = textContent.slice(0, maxChars) + '...';
    }

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes written content. Provide concise, clear summaries that capture the main points and themes. Keep summaries to 2-3 sentences for short content, or a brief paragraph for longer pieces.',
        },
        {
          role: 'user',
          content: `Please summarize the following ${post.type}${post.title ? ` titled "${post.title}"` : ''}:\n\n${textContent}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.5,
    });

    const summary = completion.choices[0]?.message?.content || 'Unable to generate summary';

    res.json({ summary });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// Get AI-suggested highlights for a post
postsRouter.post('/:id/suggest-highlights', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const postId = parseInt(req.params.id);

    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
      with: {
        chapters: true,
      },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check access for paid content
    if (post.isPaid && req.userId !== post.authorId) {
      const subscription = await db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.subscriberId, req.userId!),
          eq(subscriptions.creatorId, post.authorId),
          eq(subscriptions.status, 'active')
        ),
      });
      if (!subscription) {
        return res.status(403).json({ error: 'Subscribe to access this content' });
      }
    }

    // Extract text content (strip HTML tags)
    let textContent = '';
    if (post.type === 'book' && post.chapters && post.chapters.length > 0) {
      textContent = post.chapters
        .map(ch => `${ch.title}\n${ch.content?.replace(/<[^>]*>/g, '') || ''}`)
        .join('\n\n');
    } else {
      textContent = post.content?.replace(/<[^>]*>/g, '') || '';
    }

    if (!textContent.trim()) {
      return res.status(400).json({ error: 'No content to analyze' });
    }

    // Truncate to avoid token limits
    const maxChars = 30000;
    if (textContent.length > maxChars) {
      textContent = textContent.slice(0, maxChars) + '...';
    }

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that identifies noteworthy passages in written content.
Analyze the text and identify 3-5 passages worth highlighting.
Look for: key insights, memorable quotes, surprising facts, main arguments, compelling phrases.

IMPORTANT: Return ONLY exact text from the content - do not paraphrase or summarize.
Return your response as a JSON array with this exact format:
[{"text": "exact quote from the text", "reason": "brief explanation of why it's noteworthy"}]

Keep each passage to 1-3 sentences. Make sure the text field contains an EXACT match from the content.`,
        },
        {
          role: 'user',
          content: `Please identify noteworthy passages from the following content:\n\n${textContent}`,
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{"suggestions":[]}';
    console.log('AI response:', responseText);

    let suggestions: Array<{ text: string; reason: string }> = [];
    try {
      const parsed = JSON.parse(responseText);
      console.log('Parsed response:', JSON.stringify(parsed, null, 2));

      // Handle various response formats the AI might use
      if (Array.isArray(parsed)) {
        suggestions = parsed;
      } else if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        suggestions = parsed.suggestions;
      } else if (parsed.highlights && Array.isArray(parsed.highlights)) {
        suggestions = parsed.highlights;
      } else if (parsed.passages && Array.isArray(parsed.passages)) {
        suggestions = parsed.passages;
      } else {
        // Try to find any array property in the response
        const arrayKey = Object.keys(parsed).find(key => Array.isArray(parsed[key]));
        if (arrayKey) {
          suggestions = parsed[arrayKey];
        }
      }
      console.log('Extracted suggestions:', suggestions.length);
    } catch (e) {
      console.error('Failed to parse AI response:', responseText, e);
      suggestions = [];
    }

    res.json({ suggestions });
  } catch (error) {
    console.error('Error generating highlight suggestions:', error);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});
