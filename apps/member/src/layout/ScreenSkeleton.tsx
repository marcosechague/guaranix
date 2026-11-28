import { Skeleton } from '@guaranix/ui';

/** Shape of a typical screen while its code or data loads. */
export function ScreenSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4 px-5 pt-7">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 h-44 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    </div>
  );
}
