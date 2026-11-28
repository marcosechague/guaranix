import { t } from '@guaranix/shared';
import { Page, PageHeader, Skeleton } from '@guaranix/ui';
import { LoadError, useBoxClock, usePaymentDetails } from '@guaranix/ui/data';
import { useBookingPolicy } from '../../api/queries';
import { canManage } from '../../lib/roles';
import { BookingPolicyCard } from './BookingPolicyCard';
import { CardPaymentsCard } from './CardPaymentsCard';
import { LocationsCard } from './LocationsCard';
import { PaymentDetailsCard } from './PaymentDetailsCard';
import { SchedulesCard } from './SchedulesCard';

export function SettingsScreen() {
  const { role } = useBoxClock();
  const policy = useBookingPolicy();
  const paymentDetails = usePaymentDetails();
  const editable = canManage(role);
  return (
    <Page layout="panel">
      <PageHeader
        size="large"
        title={t('admin.settings.title')}
        subtitle={t('admin.settings.subtitle')}
      />
      {policy.isPending ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : policy.isError ? (
        <LoadError error={policy.error} onRetry={() => void policy.refetch()} />
      ) : (
        <BookingPolicyCard policy={policy.data} editable={editable} />
      )}
      <LocationsCard editable={editable} />
      <SchedulesCard editable={editable} />
      {paymentDetails.isPending ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : paymentDetails.isError ? (
        <LoadError error={paymentDetails.error} onRetry={() => void paymentDetails.refetch()} />
      ) : (
        <PaymentDetailsCard details={paymentDetails.data} editable={editable} />
      )}
      {editable ? <CardPaymentsCard isOwner={role === 'box_owner'} /> : null}
    </Page>
  );
}
