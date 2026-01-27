import { Router } from 'express';
import { eq, like, desc } from 'drizzle-orm';
import { db, categories } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

export const categoriesRouter = Router();

// Get all categories
categoriesRouter.get('/', async (req, res) => {
  try {
    const { search } = req.query;

    let allCategories;
    if (search) {
      allCategories = await db.query.categories.findMany({
        where: like(categories.name, `%${search}%`),
        orderBy: desc(categories.createdAt),
      });
    } else {
      allCategories = await db.query.categories.findMany({
        orderBy: desc(categories.createdAt),
      });
    }

    res.json(allCategories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get category by slug
categoriesRouter.get('/slug/:slug', async (req, res) => {
  try {
    const category = await db.query.categories.findFirst({
      where: eq(categories.slug, req.params.slug),
      with: {
        posts: {
          with: {
            post: {
              with: {
                author: true,
                appreciations: true,
              },
            },
          },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// Get category by ID
categoriesRouter.get('/:id', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);

    const category = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
      with: {
        posts: {
          with: {
            post: {
              with: {
                author: true,
                appreciations: true,
              },
            },
          },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// Create category
categoriesRouter.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check if category already exists
    const existing = await db.query.categories.findFirst({
      where: eq(categories.slug, slug),
    });

    if (existing) {
      return res.json(existing);
    }

    const [newCategory] = await db.insert(categories).values({
      name,
      slug,
      description,
    }).returning();

    res.status(201).json(newCategory);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Get popular categories
categoriesRouter.get('/popular/list', async (_req, res) => {
  try {
    const allCategories = await db.query.categories.findMany({
      with: {
        posts: true,
      },
    });

    // Sort by number of posts
    const sortedCategories = allCategories
      .map(cat => ({
        ...cat,
        postCount: cat.posts.length,
      }))
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, 20);

    res.json(sortedCategories);
  } catch (error) {
    console.error('Error fetching popular categories:', error);
    res.status(500).json({ error: 'Failed to fetch popular categories' });
  }
});
