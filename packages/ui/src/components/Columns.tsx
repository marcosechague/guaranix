import type { ReactNode } from 'react';
import { classNames } from '../lib/class-names';

export interface ColumnsProps {
  /** `even` splits in halves; `wide-start` gives the first column 3/5 of the width. */
  split?: 'even' | 'wide-start';
  start: ReactNode;
  end?: ReactNode;
  className?: string | undefined;
}

/**
 * One column on phones and tablets, two side by side on desktops, so wide
 * screens show more at once instead of a stretched single column.
 */
export function Columns({ split = 'even', start, end, className }: ColumnsProps) {
  const wide = split === 'wide-start';
  return (
    <div
      className={classNames(
        'grid grid-cols-1 gap-4 lg:items-start lg:gap-5',
        wide ? 'lg:grid-cols-5' : 'lg:grid-cols-2',
        className,
      )}
    >
      <div className={classNames('flex min-w-0 flex-col gap-4 lg:gap-5', wide && 'lg:col-span-3')}>
        {start}
      </div>
      {end ? (
        <div
          className={classNames('flex min-w-0 flex-col gap-4 lg:gap-5', wide && 'lg:col-span-2')}
        >
          {end}
        </div>
      ) : null}
    </div>
  );
}
