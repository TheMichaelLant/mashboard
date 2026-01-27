import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { db, follows, users } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

export const followsRouter = Router();

// Follow a user
followsRouter.post('/:userId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Check if user exists
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already following
    const existing = await db.query.follows.findFirst({
      where: and(
        eq(follows.followerId, req.userId!),
        eq(follows.followingId, userId)
      ),
    });

    if (existing) {
      return res.status(400).json({ error: 'Already following this user' });
    }

    await db.insert(follows).values({
      followerId: req.userId!,
      followingId: userId,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// Unfollow a user
followsRouter.delete('/:userId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;

    await db.delete(follows)
      .where(and(
        eq(follows.followerId, req.userId!),
        eq(follows.followingId, userId)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Get followers of a user
followsRouter.get('/followers/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const userFollowers = await db.query.follows.findMany({
      where: eq(follows.followingId, userId),
      with: {
        follower: true,
      },
      limit: parseInt(limit as string),
      offset,
    });

    res.json(userFollowers.map(f => f.follower));
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// Get users that a user is following
followsRouter.get('/following/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const userFollowing = await db.query.follows.findMany({
      where: eq(follows.followerId, userId),
      with: {
        following: true,
      },
      limit: parseInt(limit as string),
      offset,
    });

    res.json(userFollowing.map(f => f.following));
  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

// Check if following a user
followsRouter.get('/check/:userId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;

    const follow = await db.query.follows.findFirst({
      where: and(
        eq(follows.followerId, req.userId!),
        eq(follows.followingId, userId)
      ),
    });

    res.json({ isFollowing: !!follow });
  } catch (error) {
    console.error('Error checking follow status:', error);
    res.status(500).json({ error: 'Failed to check follow status' });
  }
});
