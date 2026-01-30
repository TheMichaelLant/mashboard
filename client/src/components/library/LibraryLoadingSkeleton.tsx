export default function LibraryLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card p-6 animate-pulse">
          <div className="h-4 bg-ink-700 rounded w-3/4 mb-2" />
          <div className="h-4 bg-ink-700 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}
