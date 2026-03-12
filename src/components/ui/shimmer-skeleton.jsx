import { cn } from '@/lib/utils';

/**
 * HeroUI-style shimmer skeleton with sweep gradient animation.
 * Uses animate-shimmer keyframe defined in tailwind.config.js.
 */
function Shimmer({ className, ...props }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-hero-lg bg-zinc-200 dark:bg-zinc-800',
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-zinc-300/60 dark:via-zinc-600/10 to-transparent" />
    </div>
  );
}

/** Skeleton card: icon + 3 text lines */
function SkeletonCard({ className }) {
  return (
    <div className={cn('rounded-[14px] bg-white dark:bg-zinc-900 shadow-hero-sm p-5 space-y-4', className)}>
      <div className="flex items-center gap-3">
        <Shimmer className="h-10 w-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Shimmer className="h-4 w-3/4" />
          <Shimmer className="h-3 w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <Shimmer className="h-3 w-full" />
        <Shimmer className="h-3 w-5/6" />
      </div>
    </div>
  );
}

/** Skeleton table: header + N rows */
function SkeletonTable({ rows = 5, cols = 4, className }) {
  return (
    <div className={cn('rounded-[14px] bg-white dark:bg-zinc-900 shadow-hero-sm overflow-hidden', className)}>
      {/* Header */}
      <div className="flex gap-3 px-4 py-3 bg-zinc-100 dark:bg-zinc-800">
        {Array.from({ length: cols }).map((_, i) => (
          <Shimmer key={i} className="h-4 flex-1 rounded-md" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Shimmer
              key={colIdx}
              className="h-4 flex-1 rounded-md"
              style={{ width: colIdx === 0 ? '40%' : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton stats row: N stat boxes in a grid */
function SkeletonStats({ count = 4, className }) {
  return (
    <div className={cn('grid gap-4', className)} style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-[14px] bg-white dark:bg-zinc-900 shadow-hero-sm p-4 space-y-3">
          <Shimmer className="h-3 w-1/2 rounded-md" />
          <Shimmer className="h-8 w-2/3 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton grid of cards */
function SkeletonGrid({ count = 6, cols = 3, className }) {
  return (
    <div className={cn('grid gap-4', className)} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export { Shimmer, SkeletonCard, SkeletonTable, SkeletonStats, SkeletonGrid };
