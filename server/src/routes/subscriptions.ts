import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db, subscriptions, users, creatorSettings } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

export const subscriptionsRouter = Router();

// Subscribe to a creator
subscriptionsRouter.post('/:creatorId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { creatorId } = req.params;

    if (creatorId === req.userId) {
      return res.status(400).json({ error: 'Cannot subscribe to yourself' });
    }

    // Check if creator exists and accepts subscriptions
    const creator = await db.query.users.findFirst({
      where: eq(users.id, creatorId),
    });

    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const settings = await db.query.creatorSettings.findFirst({
      where: eq(creatorSettings.userId, creatorId),
    });

    if (!settings?.acceptsSubscriptions) {
      return res.status(400).json({ error: 'This creator does not accept subscriptions' });
    }

    // Check if already subscribed
    const existing = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.subscriberId, req.userId!),
        eq(subscriptions.creatorId, creatorId),
        eq(subscriptions.status, 'active')
      ),
    });

    if (existing) {
      return res.status(400).json({ error: 'Already subscribed to this creator' });
    }

    // Calculate expiry (1 month from now)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const [newSubscription] = await db.insert(subscriptions).values({
      subscriberId: req.userId!,
      creatorId,
      price: settings.subscriptionPrice || 0,
      status: 'active',
      expiresAt,
    }).returning();

    res.status(201).json(newSubscription);
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Cancel subscription
subscriptionsRouter.delete('/:creatorId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { creatorId } = req.params;

    const subscription = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.subscriberId, req.userId!),
        eq(subscriptions.creatorId, creatorId),
        eq(subscriptions.status, 'active')
      ),
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    await db.update(subscriptions)
      .set({ status: 'cancelled' })
      .where(eq(subscriptions.id, subscription.id));

    res.json({ success: true });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Get user's subscriptions (creators they subscribe to)
subscriptionsRouter.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { status } = req.query;
    const { page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const userSubscriptions = await db.query.subscriptions.findMany({
      where: status
        ? and(
            eq(subscriptions.subscriberId, req.userId!),
            eq(subscriptions.status, status as 'active' | 'cancelled' | 'expired')
          )
        : eq(subscriptions.subscriberId, req.userId!),
      with: {
        creator: true,
      },
      orderBy: desc(subscriptions.createdAt),
      limit: parseInt(limit as string),
      offset,
    });

    res.json(userSubscriptions);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// Get user's subscribers (people subscribed to them)
subscriptionsRouter.get('/subscribers', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const userSubscribers = await db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.creatorId, req.userId!),
        eq(subscriptions.status, 'active')
      ),
      with: {
        subscriber: true,
      },
      orderBy: desc(subscriptions.createdAt),
      limit: parseInt(limit as string),
      offset,
    });

    res.json(userSubscribers);
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

// Check subscription status
subscriptionsRouter.get('/check/:creatorId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { creatorId } = req.params;

    const subscription = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.subscriberId, req.userId!),
        eq(subscriptions.creatorId, creatorId),
        eq(subscriptions.status, 'active')
      ),
    });

    res.json({ isSubscribed: !!subscription, subscription });
  } catch (error) {
    console.error('Error checking subscription status:', error);
    res.status(500).json({ error: 'Failed to check subscription status' });
  }
});
