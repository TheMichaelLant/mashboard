import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { clerkMiddleware } from '@clerk/express';

import { usersRouter } from './routes/users.js';
import { postsRouter } from './routes/posts.js';
import { categoriesRouter } from './routes/categories.js';
import { followsRouter } from './routes/follows.js';
import { appreciationsRouter } from './routes/appreciations.js';
import { bookmarksRouter } from './routes/bookmarks.js';
import { highlightsRouter } from './routes/highlights.js';
import { subscriptionsRouter } from './routes/subscriptions.js';
import { feedRouter } from './routes/feed.js';
import { discoverRouter } from './routes/discover.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(clerkMiddleware());

// Routes
app.use('/api/users', usersRouter);
app.use('/api/posts', postsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/follows', followsRouter);
app.use('/api/appreciations', appreciationsRouter);
app.use('/api/bookmarks', bookmarksRouter);
app.use('/api/highlights', highlightsRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/feed', feedRouter);
app.use('/api/discover', discoverRouter);

// Health check
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
