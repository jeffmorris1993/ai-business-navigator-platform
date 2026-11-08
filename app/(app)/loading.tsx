import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-10" role="status" aria-label="Loading">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-10 w-2/3 max-w-xl" />
        <Skeleton className="h-4 w-1/2 max-w-md" />
      </div>
      <div className="grid grid-cols-2 gap-6 border-y border-line py-6 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-9 w-28" /></div>)}
      </div>
      <div className="grid gap-8 xl:grid-cols-[1fr_380px]">
        <Skeleton className="h-72 rounded-panel" />
        <Skeleton className="h-72 rounded-panel" />
      </div>
    </div>
  );
}
