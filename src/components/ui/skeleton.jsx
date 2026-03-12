import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    (<div
      className={cn("relative overflow-hidden rounded-md bg-zinc-200/60 dark:bg-zinc-800/60", className)}
      {...props}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-zinc-300/50 dark:via-zinc-600/10 to-transparent" />
    </div>)
  );
}

export { Skeleton }
