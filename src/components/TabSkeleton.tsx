import { Skeleton } from "@/components/ui/skeleton";

const TabSkeleton = () => (
  <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
    {/* Header skeleton */}
    <div className="flex items-center gap-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <Skeleton className="h-5 w-40" />
    </div>
    {/* Card skeletons */}
    {[1, 2, 3].map((i) => (
      <div key={i} className="rounded-xl border border-border p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
    ))}
  </div>
);

export default TabSkeleton;
