import type { BookingStatus } from '@guaranix/shared/domain';
import { t } from '@guaranix/shared';
import { Button, Sheet, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { useCancelBooking } from '../../api/mutations';

export interface CancelTarget {
  bookingId: string;
  status: BookingStatus;
  waitlistPosition: number | null;
  day: string;
  time: string;
  program: string;
}

export interface CancelBookingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: CancelTarget | null;
}

/** Cancelling is the only booking action that asks first: a late cancel can cost a class. */
export function CancelBookingSheet({ open, onOpenChange, target }: CancelBookingSheetProps) {
  const cancel = useCancelBooking();
  const toast = useToast();
  if (!target) return null;
  const waitlisted = target.status === 'waitlisted';
  const confirm = () =>
    cancel.mutate(target.bookingId, {
      onSuccess: () => {
        onOpenChange(false);
        toast.show(t('member.book.cancelledToast'));
      },
      onError: (error) => toast.show(errorText(error), 'error'),
    });
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      closeLabel={t('common.close')}
      title={waitlisted ? t('member.book.leaveWaitlistTitle') : t('member.book.cancelTitle')}
      description={
        waitlisted
          ? t('member.book.leaveWaitlistBody', {
              position: target.waitlistPosition ?? 1,
              day: target.day,
              time: target.time,
            })
          : t('member.book.cancelBody', {
              day: target.day,
              time: target.time,
              program: target.program,
            })
      }
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
            {t('member.book.keep')}
          </Button>
          <Button variant="danger" className="flex-1" disabled={cancel.isPending} onClick={confirm}>
            {t('member.book.confirmCancel')}
          </Button>
        </>
      }
    />
  );
}
