import { Link } from 'react-router-dom';

interface LibraryEmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

export default function LibraryEmptyState({ icon: Icon, title, description }: LibraryEmptyStateProps) {
  return (
    <div className="card p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-ink-800 flex items-center justify-center mx-auto mb-4">
        <Icon className="text-ink-500" size={32} />
      </div>
      <h2 className="text-xl font-display font-bold text-ink-100 mb-2">
        {title}
      </h2>
      <p className="text-ink-400 mb-6">{description}</p>
      <Link to="/discover" className="btn btn-primary">
        Discover Content
      </Link>
    </div>
  );
}
