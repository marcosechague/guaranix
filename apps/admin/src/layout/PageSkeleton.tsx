import { Page, Skeleton } from '@guaranix/ui';

export function PageSkeleton() {
  return (
    <Page layout="panel">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-4 w-72" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </Page>
  );
}
