interface SkeletonProps {
  className?: string;
}

export enum SkeletonType { 
  POST = 'post',
  FEED = 'feed',
  PROFILE = 'profile',
  CARD = 'card',
  CARDS = 'cards',
}

// Primitive building blocks
export function SkeletonLine({ className = '' }: SkeletonProps) {
  return <div className={`h-4 bg-ink-700 rounded ${className}`} />;
}

export function SkeletonCircle({ className = '' }: SkeletonProps) {
  return <div className={`rounded-full bg-ink-700 ${className}`} />;
}

export function SkeletonBlock({ className = '' }: SkeletonProps) {
  return <div className={`bg-ink-700 rounded ${className}`} />;
}

// Preset variants
interface LoadingSkeletonProps {
  variant?: SkeletonType;
  count?: number;
  className?: string;
}

export default function LoadingSkeleton({
  variant = SkeletonType.POST,
  count = 1,
  className = '',
}: LoadingSkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  switch (variant) {
    case SkeletonType.FEED:
      return (
        <div data-scroll="snap" className={className}>
          <div data-scroll-item className="flex items-center justify-center">
            <div className="max-w-3xl w-full px-8 animate-pulse">
              <SkeletonBlock className="h-16 w-3/4 mb-6" />
              <div className="flex items-center gap-4 mb-6">
                <SkeletonCircle className="w-12 h-12" />
                <div className="space-y-2">
                  <SkeletonLine className="w-40" />
                  <SkeletonLine className="h-3 w-32" />
                </div>
              </div>
              <div className="space-y-3">
                <SkeletonLine className="w-full" />
                <SkeletonLine className="w-5/6" />
                <SkeletonLine className="w-4/6" />
              </div>
            </div>
          </div>
        </div>
      );

    case SkeletonType.POST:
      return (
        <div className={`max-w-3xl mx-auto px-8 py-12 animate-pulse ${className}`}>
          <SkeletonBlock className="h-12 w-3/4 mb-4" />
          <SkeletonLine className="w-1/4 mb-8" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonLine key={i} />
            ))}
          </div>
        </div>
      );

    case SkeletonType.PROFILE:
      return (
        <div className={`max-w-4xl mx-auto px-4 py-12 ${className}`}>
          <div className="animate-pulse">
            <div className="flex flex-col items-center mb-12">
              <SkeletonCircle className="w-28 h-28 mb-6" />
              <SkeletonBlock className="h-8 w-48 mb-3" />
              <SkeletonBlock className="h-5 w-32 mb-6" />
              <div className="flex gap-8">
                <SkeletonLine className="w-20" />
                <SkeletonLine className="w-20" />
                <SkeletonLine className="w-20" />
              </div>
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <SkeletonBlock key={i} className="h-40 bg-ink-800/50 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      );

    case SkeletonType.CARD:
      return (
        <div className={`card p-6 animate-pulse ${className}`}>
          <SkeletonLine className="w-3/4 mb-2" />
          <SkeletonLine className="w-1/2" />
        </div>
      );

    case SkeletonType.CARDS:
      return (
        <div className={`space-y-4 ${className}`}>
          {items.map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <SkeletonLine className="w-3/4 mb-2" />
              <SkeletonLine className="w-1/2" />
            </div>
          ))}
        </div>
      );

    default:
      return (
        <div className={`animate-pulse ${className}`}>
          <SkeletonLine />
        </div>
      );
  }
}
