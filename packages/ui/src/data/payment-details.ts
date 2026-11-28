import type { BoxPaymentDetails, BoxPaymentDetailsInput } from '@guaranix/shared/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useApi } from './ApiProvider';

export const paymentDetailsKeys = {
  details: ['box', 'payment-details'] as const,
  qr: ['box', 'payment-qr'] as const,
};

/** Where the box takes transfers and QR payments; every role of the box may read it. */
export function usePaymentDetails() {
  const api = useApi();
  return useQuery({
    queryKey: paymentDetailsKeys.details,
    queryFn: async () =>
      (await api.get<{ details: BoxPaymentDetails }>('/box/payment-details')).details,
    staleTime: 10 * 60_000,
  });
}

/** The QR image as a local object URL, revoked when it changes or the screen goes away. */
export function usePaymentQrUrl(hasQr: boolean): string | null {
  const api = useApi();
  const image = useQuery({
    queryKey: paymentDetailsKeys.qr,
    enabled: hasQr,
    staleTime: 10 * 60_000,
    queryFn: () => api.blob('/box/payment-details/qr'),
  });
  const [url, setUrl] = useState<string | null>(null);
  const blob = hasQr ? image.data : undefined;
  useEffect(() => {
    if (!blob) return setUrl(null);
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return url;
}

function useDetailsMutation<Input>(
  send: (input: Input) => Promise<{ details: BoxPaymentDetails }>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Input) => (await send(input)).details,
    onSuccess: (details) => {
      queryClient.setQueryData(paymentDetailsKeys.details, details);
      return queryClient.invalidateQueries({ queryKey: paymentDetailsKeys.qr });
    },
  });
}

export function useSavePaymentDetails() {
  const api = useApi();
  return useDetailsMutation((input: BoxPaymentDetailsInput) =>
    api.patch<{ details: BoxPaymentDetails }>('/box/payment-details', input),
  );
}

export function useUploadPaymentQr() {
  const api = useApi();
  return useDetailsMutation((file: File) =>
    api.upload<{ details: BoxPaymentDetails }>('/box/payment-details/qr', file),
  );
}

export function useRemovePaymentQr() {
  const api = useApi();
  return useDetailsMutation(() =>
    api.delete<{ details: BoxPaymentDetails }>('/box/payment-details/qr'),
  );
}
