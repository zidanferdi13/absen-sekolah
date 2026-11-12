import { CardSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-3 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-40 w-full" />
      </div>
    </div>
  );
}
