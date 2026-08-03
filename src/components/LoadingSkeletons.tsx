import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for the stats summary cards + chart area. */
export const StatsSkeleton = () => (
  <div className="space-y-4">
    <Skeleton className="h-9 w-full rounded-lg" />
    <div className="grid grid-cols-2 gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border border-border rounded-lg p-3 bg-secondary space-y-2">
          <Skeleton className="h-5 w-5 mx-auto rounded-full" />
          <Skeleton className="h-6 w-16 mx-auto" />
          <Skeleton className="h-2.5 w-20 mx-auto" />
        </div>
      ))}
    </div>
    <Skeleton className="h-24 w-full rounded-lg" />
    <Skeleton className="h-40 w-full rounded-lg" />
  </div>
);

/** Skeleton for social feed post cards. */
export const FeedSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="border border-border rounded-2xl bg-card p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
        <Skeleton className="h-3.5 w-4/5" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    ))}
  </div>
);

export default StatsSkeleton;
