import { formatGuarani, t, translateApiError } from '@guaranix/shared';
import {
  ApiError,
  createApiClient,
  type HostedCheckoutView,
  type PaymentLinkView,
} from '@guaranix/shared/api';
import { Button, Card, FormMessage, GuaranixLogo, Page, PageHeader, Skeleton } from '@guaranix/ui';
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import { CircleCheck } from 'lucide-react';
import { API_URL } from '../../config';
import { HostedCheckout } from '../../payments/HostedCheckout';

// No session here: whoever has the link can pay, and sees only the charge.
const api = createApiClient({ baseUrl: API_URL, getCsrfToken: () => null });
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const tokenFromPath = () => window.location.pathname.split('/').filter(Boolean)[1] ?? '';

const messageOf = (error: unknown) =>
  translateApiError(error instanceof ApiError ? error.code : 'internal_error');

function LinkStatus({ link }: { link: PaymentLinkView }) {
  if (link.status === 'paid') {
    return (
      <p className="flex items-center gap-2 text-success">
        <CircleCheck aria-hidden="true" size={20} />
        {t('member.pay.paid')}
      </p>
    );
  }
  return <p className="text-text-secondary">{translateApiError(`payment_link_${link.status}`)}</p>;
}

function PayLink({ token }: { token: string }) {
  const link = useQuery({
    queryKey: ['pay', token],
    queryFn: async () => (await api.get<{ link: PaymentLinkView }>(`/pay/${token}`)).link,
  });
  const checkout = useMutation({
    mutationFn: async () =>
      (await api.post<{ checkout: HostedCheckoutView }>(`/pay/${token}/checkout`)).checkout,
  });
  const simulate = useMutation({
    mutationFn: (approved: boolean) => api.post(`/pay/${token}/simulate`, { approved }),
    onSettled: () => {
      checkout.reset();
      void link.refetch();
    },
  });
  const error = link.error ?? checkout.error ?? simulate.error;
  const data = link.data;

  return (
    <Page layout="mobile">
      <GuaranixLogo />
      <PageHeader
        title={data ? data.boxName : t('member.pay.title')}
        subtitle={data ? t('member.pay.greeting', { name: data.firstName }) : undefined}
      />
      {link.isPending ? <Skeleton className="h-48 rounded-xl" /> : null}
      {data ? (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-text-secondary">{data.description}</span>
            <span className="font-display text-4xl font-bold tabular-nums">
              {formatGuarani(data.amountGs)}
            </span>
          </div>
          {data.status !== 'payable' ? (
            <LinkStatus link={data} />
          ) : checkout.data ? (
            <HostedCheckout
              checkout={checkout.data}
              onSimulate={(approved) => simulate.mutate(approved)}
            />
          ) : (
            <Button type="button" disabled={checkout.isPending} onClick={() => checkout.mutate()}>
              {checkout.isPending ? t('common.loading') : t('member.pay.payWithCard')}
            </Button>
          )}
          <p className="text-xs text-text-secondary">{t('member.cards.safety')}</p>
        </Card>
      ) : null}
      {error ? <FormMessage tone="error">{messageOf(error)}</FormMessage> : null}
    </Page>
  );
}

/** The page a payment link opens (`/pagar/<token>`), outside the logged-in app. */
export function PayLinkScreen() {
  return (
    <QueryClientProvider client={queryClient}>
      <PayLink token={tokenFromPath()} />
    </QueryClientProvider>
  );
}
