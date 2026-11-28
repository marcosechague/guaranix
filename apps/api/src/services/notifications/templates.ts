import type { NotificationKind } from '@guaranix/shared';

/**
 * WhatsApp templates GuaraniX submits to Meta (see `docs/notificaciones.md`
 * for their exact text). The order of `parameters` is `{{1}}`, `{{2}}`…; a
 * change here needs the template approved again.
 */
export const WHATSAPP_TEMPLATES: Partial<
  Record<NotificationKind, { name: string; parameters: string[] }>
> = {
  membership_due: {
    name: 'guaranix_cuota_por_vencer',
    parameters: ['firstName', 'box', 'amount', 'date'],
  },
  membership_overdue: {
    name: 'guaranix_cuota_vencida',
    parameters: ['firstName', 'box', 'amount', 'date'],
  },
};
