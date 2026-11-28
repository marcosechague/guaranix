import { Page, Skeleton } from '@guaranix/ui';

/** Stat row and a list, the shape of every platform screen while it loads. */
export function ScreenSkeleton() {
  return (
    <Page layout="panel">
      <Skeleton className="h-9 w-56" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </Page>
  );
}
