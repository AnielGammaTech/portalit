import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('rounded-md bg-slate-200/80 skeleton-shimmer', className)}
      {...props}
    />
  )
}

export { Skeleton }
