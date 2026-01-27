# Mashboard

A typography-driven social media platform where words matter. Share your writings with the world through beautifully crafted text - no images, no videos, just pure typographical expression.

## Features

### Post Types
- **Line**: A single thought, quote, or statement
- **Page**: A complete piece - essay, article, or story
- **Book**: Multi-chapter works with serialized content

### Rich Typography
- Multiple font families (Classic, Modern, Elegant, Bold, Script, Code)
- Text formatting (bold, italic, underline, strikethrough, highlight)
- Headings, lists, quotes, and code blocks
- Text alignment and color options

### Social Features
- Follow other writers
- "Appreciate" posts (like system)
- Bookmark pages and archive books
- Highlight text passages
- Categorize posts with hashtags

### Discovery
- Browse trending and latest content
- Search posts and writers
- Explore by category
- Featured writers section

### Monetization
- Set up creator subscriptions
- Mark posts as paid content
- Subscribers get access to premium content

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **Database**: SQLite with Drizzle ORM
- **Authentication**: Clerk
- **Rich Text Editor**: TipTap

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup

1. Clone the repository and install dependencies:
```bash
cd mashboard
npm install
```

2. Set up environment variables:

For the server (`server/.env`):
```
PORT=3001
CLIENT_URL=http://localhost:5173
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

For the client (`client/.env`):
```
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

3. Generate and run database migrations:
```bash
npm run db:generate
npm run db:migrate
```

4. Start the development servers:
```bash
npm run dev
```

This will start:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Project Structure

```
mashboard/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API service functions
│   │   ├── types/          # TypeScript types
│   │   └── styles/         # Global styles
│   └── ...
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── middleware/     # Express middleware
│   │   └── db/             # Database schema and config
│   └── ...
└── package.json            # Root package.json
```

## API Endpoints

### Users
- `GET /api/users/me` - Get current user
- `POST /api/users/me` - Create/update user profile
- `GET /api/users/:id` - Get user by ID
- `GET /api/users/username/:username` - Get user by username

### Posts
- `GET /api/posts` - Get current user's posts
- `GET /api/posts/:id` - Get post by ID
- `POST /api/posts` - Create post
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post

### Social
- `POST /api/follows/:userId` - Follow user
- `DELETE /api/follows/:userId` - Unfollow user
- `POST /api/appreciations/:postId` - Appreciate post
- `POST /api/bookmarks/:postId` - Bookmark post
- `POST /api/highlights` - Create highlight

### Discovery
- `GET /api/discover/search` - Search posts and users
- `GET /api/discover/trending` - Get trending posts
- `GET /api/discover/latest` - Get latest posts
- `GET /api/feed` - Get user's feed

## License

MIT
