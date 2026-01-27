import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, users, creatorSettings, follows, posts } from '../db/index.js';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth.js';

export const usersRouter = Router();

// Get current user profile
usersRouter.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
      with: {
        creatorSettings: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create or update user profile
usersRouter.post('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { username, displayName, bio, avatarUrl } = req.body;

    const existing = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
    });

    if (existing) {
      await db.update(users)
        .set({
          username,
          displayName,
          bio,
          avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.userId!));
    } else {
      await db.insert(users).values({
        id: req.userId!,
        username,
        displayName,
        bio,
        avatarUrl,
      });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
    });

    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Get user by username
usersRouter.get('/username/:username', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.username, req.params.username),
      with: {
        creatorSettings: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get follower/following counts
    const followerCount = await db.query.follows.findMany({
      where: eq(follows.followingId, user.id),
    });

    const followingCount = await db.query.follows.findMany({
      where: eq(follows.followerId, user.id),
    });

    // Get post count
    const postCount = await db.query.posts.findMany({
      where: eq(posts.authorId, user.id),
    });

    // Check if current user follows this user
    let isFollowing = false;
    if (req.userId) {
      const follow = await db.query.follows.findFirst({
        where: (f, { and }) => and(
          eq(f.followerId, req.userId!),
          eq(f.followingId, user.id)
        ),
      });
      isFollowing = !!follow;
    }

    res.json({
      ...user,
      followerCount: followerCount.length,
      followingCount: followingCount.length,
      postCount: postCount.length,
      isFollowing,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get user by ID
usersRouter.get('/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.params.id),
      with: {
        creatorSettings: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get follower/following counts
    const followerCount = await db.query.follows.findMany({
      where: eq(follows.followingId, user.id),
    });

    const followingCount = await db.query.follows.findMany({
      where: eq(follows.followerId, user.id),
    });

    // Get post count
    const postCount = await db.query.posts.findMany({
      where: eq(posts.authorId, user.id),
    });

    // Check if current user follows this user
    let isFollowing = false;
    if (req.userId && req.userId !== user.id) {
      const follow = await db.query.follows.findFirst({
        where: (f, { and }) => and(
          eq(f.followerId, req.userId!),
          eq(f.followingId, user.id)
        ),
      });
      isFollowing = !!follow;
    }

    res.json({
      ...user,
      followerCount: followerCount.length,
      followingCount: followingCount.length,
      postCount: postCount.length,
      isFollowing,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update creator settings
usersRouter.post('/me/creator-settings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { subscriptionPrice, acceptsSubscriptions } = req.body;

    const existing = await db.query.creatorSettings.findFirst({
      where: eq(creatorSettings.userId, req.userId!),
    });

    if (existing) {
      await db.update(creatorSettings)
        .set({
          subscriptionPrice,
          acceptsSubscriptions,
          updatedAt: new Date(),
        })
        .where(eq(creatorSettings.userId, req.userId!));
    } else {
      await db.insert(creatorSettings).values({
        userId: req.userId!,
        subscriptionPrice,
        acceptsSubscriptions,
      });
    }

    const settings = await db.query.creatorSettings.findFirst({
      where: eq(creatorSettings.userId, req.userId!),
    });

    res.json(settings);
  } catch (error) {
    console.error('Error updating creator settings:', error);
    res.status(500).json({ error: 'Failed to update creator settings' });
  }
});

// Check if username is available
usersRouter.get('/check-username/:username', async (req, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.username, req.params.username),
    });

    res.json({ available: !user });
  } catch (error) {
    console.error('Error checking username:', error);
    res.status(500).json({ error: 'Failed to check username' });
  }
});
