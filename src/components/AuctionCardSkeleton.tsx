import { Skeleton } from "@/components/ui/skeleton";

const AuctionCardSkeleton = () => (
  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
    <Skeleton className="aspect-square w-full rounded-none" />
    <div className="p-4 space-y-2.5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex items-end justify-between pt-2">
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-7 w-24" />
        </div>
        <Skeleton className="h-5 w-24 rounded-lg" />
      </div>
    </div>
  </div>
);

export const AuctionGridSkeleton = ({ count = 8 }: { count?: number }) => (
  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
    {Array.from({ length: count }).map((_, i) => (
      <AuctionCardSkeleton key={i} />
    ))}
  </div>
);

export default AuctionCardSkeleton;
