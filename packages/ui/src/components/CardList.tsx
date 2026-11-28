import type { HTMLAttributes, LiHTMLAttributes } from 'react';
import { classNames } from '../lib/class-names';

/** Rows split by hairlines inside a Card (debtors, fees, payments). */
export function CardList({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return (
    <ul className={classNames('flex flex-col divide-y divide-divider', className)} {...props} />
  );
}

/** One row of a CardList: content side by side, no padding above the first or below the last. */
export function CardListItem({ className, ...props }: LiHTMLAttributes<HTMLLIElement>) {
  return (
    <li
      className={classNames('flex items-center gap-3 py-3 first:pt-0 last:pb-0', className)}
      {...props}
    />
  );
}
