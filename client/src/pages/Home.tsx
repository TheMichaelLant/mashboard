import { Link } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { PenTool, Type, FileText, BookOpen, Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center py-16">
        <h1 className="text-5xl md:text-7xl font-display font-bold text-ink-900 mb-6">
          Words Matter Here
        </h1>
        <p className="text-xl md:text-2xl text-ink-600 font-body max-w-2xl mx-auto mb-8">
          Mashboard is where typography meets expression. Share your thoughts through
          beautifully crafted words — no images, no videos, just pure textual artistry.
        </p>
        <SignedOut>
          <div className="flex justify-center space-x-4">
            <Link to="/sign-up" className="btn btn-primary btn-lg">
              Start Writing
            </Link>
            <Link to="/discover" className="btn btn-secondary btn-lg">
              Explore
            </Link>
          </div>
        </SignedOut>
        <SignedIn>
          <div className="flex justify-center space-x-4">
            <Link to="/write" className="btn btn-primary btn-lg">
              <PenTool className="mr-2" size={20} />
              Create Something
            </Link>
            <Link to="/feed" className="btn btn-secondary btn-lg">
              Your Feed
            </Link>
          </div>
        </SignedIn>
      </section>

      {/* Post Types */}
      <section>
        <h2 className="text-3xl font-display font-bold text-center mb-12">
          Three Ways to Express
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <PostTypeCard
            icon={Type}
            title="Line"
            description="A single thought, quote, or statement. Perfect for aphorisms, epigrams, and memorable phrases."
            example='"The only way to do great work is to love what you do."'
            link="/write/line"
          />
          <PostTypeCard
            icon={FileText}
            title="Page"
            description="A complete piece — an essay, article, or story. Express yourself fully in one beautiful document."
            example="Essays, articles, short stories, poems, or any complete thought..."
            link="/write/page"
          />
          <PostTypeCard
            icon={BookOpen}
            title="Book"
            description="A multi-chapter work. For serials, novels, guides, or any content that spans multiple parts."
            example="Serialized fiction, comprehensive guides, memoirs..."
            link="/write/book"
          />
        </div>
      </section>

      {/* Features */}
      <section className="bg-white rounded-2xl p-8 md:p-12">
        <h2 className="text-3xl font-display font-bold text-center mb-12">
          Typography-First Experience
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            title="Rich Typography"
            description="Choose from curated fonts, sizes, and styles. Your words deserve beautiful presentation."
          />
          <FeatureCard
            title="Highlight & Save"
            description="Highlight passages that resonate. Bookmark pages. Archive entire books for later."
          />
          <FeatureCard
            title="Support Creators"
            description="Subscribe to your favorite writers. Access their premium content."
          />
          <FeatureCard
            title="Discover & Connect"
            description="Find new voices through categories and trending content. Build your reading circle."
          />
        </div>
      </section>

      {/* CTA */}
      <SignedOut>
        <section className="text-center py-12">
          <div className="inline-flex items-center space-x-2 text-amber-600 mb-4">
            <Sparkles size={24} />
            <span className="font-medium">Join the community</span>
          </div>
          <h2 className="text-4xl font-display font-bold text-ink-900 mb-4">
            Ready to share your words?
          </h2>
          <p className="text-xl text-ink-600 font-body mb-8">
            Start writing today. It's free to create and share.
          </p>
          <Link to="/sign-up" className="btn btn-primary btn-lg">
            Create Your Account
          </Link>
        </section>
      </SignedOut>
    </div>
  );
}

interface PostTypeCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  example: string;
  link: string;
}

function PostTypeCard({ icon: Icon, title, description, example, link }: PostTypeCardProps) {
  return (
    <div className="card p-6 hover:shadow-lg transition-shadow">
      <div className="w-12 h-12 rounded-xl bg-ink-100 flex items-center justify-center mb-4">
        <Icon className="text-ink-700" size={24} />
      </div>
      <h3 className="text-xl font-display font-bold text-ink-900 mb-2">{title}</h3>
      <p className="text-ink-600 font-body mb-4">{description}</p>
      <p className="text-ink-400 italic text-sm mb-4">{example}</p>
      <SignedIn>
        <Link to={link} className="btn btn-ghost btn-sm">
          Create a {title} →
        </Link>
      </SignedIn>
      <SignedOut>
        <Link to="/sign-up" className="btn btn-ghost btn-sm">
          Create a {title} →
        </Link>
      </SignedOut>
    </div>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
}

function FeatureCard({ title, description }: FeatureCardProps) {
  return (
    <div className="text-center">
      <h3 className="font-heading font-semibold text-ink-900 mb-2">{title}</h3>
      <p className="text-ink-600 text-sm">{description}</p>
    </div>
  );
}
