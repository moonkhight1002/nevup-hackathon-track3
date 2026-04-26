export function BlockSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, idx) => (
          <div key={idx} className={`skeleton h-4 rounded ${idx === 0 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="glass-card rounded-xl p-4">
          <div className="skeleton mb-3 h-3 w-24 rounded" />
          <div className="skeleton h-7 w-20 rounded" />
        </div>
      ))}
    </div>
  );
}
