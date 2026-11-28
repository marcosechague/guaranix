import { createBancardProvider } from './providers/bancard/adapter';
import { createMockPaymentProvider } from './providers/mock';
import type { PaymentProvider, PaymentProviderConfig } from './types';

/** The only place that knows which adapter backs each provider name. */
export function createPaymentProvider(config: PaymentProviderConfig): PaymentProvider {
  switch (config.provider) {
    case 'bancard':
      return createBancardProvider(config);
    case 'mock':
      return createMockPaymentProvider(config);
  }
}
