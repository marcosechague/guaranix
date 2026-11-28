import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { classNames } from '../lib/class-names';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string | undefined;
  closeLabel: string;
  children?: ReactNode;
  /** Sticky actions at the bottom (save, cancel). */
  footer?: ReactNode | undefined;
  size?: 'md' | 'lg';
}

/**
 * Bottom sheet on phones, side panel on wide screens. Radix handles focus
 * trapping, Escape and `aria-modal`; the motion is CSS so it respects reduced motion.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  footer,
  size = 'md',
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="gx-fade fixed inset-0 z-40 bg-scrim" />
        <Dialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={classNames(
            'gx-sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-xl',
            'border border-border bg-background text-text shadow-2xl outline-none',
            'md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:rounded-none md:rounded-l-xl',
            size === 'lg' ? 'md:w-[640px]' : 'md:w-[480px]',
          )}
        >
          <header
            className={classNames(
              'flex items-start justify-between gap-4 px-5 pt-5 pb-4',
              children ? 'border-b border-divider' : '',
            )}
          >
            <div className="flex flex-col gap-1">
              <Dialog.Title className="font-display text-xl font-bold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-text-secondary">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              aria-label={closeLabel}
              className="-mt-1.5 -mr-2 inline-flex size-touch items-center justify-center rounded-pill text-text-secondary hover:bg-surface hover:text-text"
            >
              <X aria-hidden="true" size={20} />
            </Dialog.Close>
          </header>
          {children ? <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div> : null}
          {footer ? (
            <footer
              className={classNames(
                'mt-auto flex gap-3 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
                children ? 'border-t border-divider' : '',
              )}
            >
              {footer}
            </footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
