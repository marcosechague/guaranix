import {
  type NotificationChannel,
  type NotificationKind,
  type NotificationParams,
  type RenderedNotification,
  t,
} from '@guaranix/shared';
import { WHATSAPP_TEMPLATES } from './templates';

export interface RenderContext {
  boxName: string;
  /** Recipient's first name, for the WhatsApp greeting. */
  firstName: string;
  whatsappLanguage: string;
  adminAppUrl: string | null;
}

type Values = Record<string, string | number>;

function textOf(params: NotificationParams, name: string): string {
  const value = params[name];
  return value === null || value === undefined ? '' : String(value);
}

function texts(kind: NotificationKind, params: NotificationParams, box: string) {
  const values: Values = { box };
  for (const [name, value] of Object.entries(params)) if (value !== null) values[name] = value;
  switch (kind) {
    case 'booking_confirmed':
    case 'waitlist_promoted':
      return {
        title: t(`notifications.${kind}.title`),
        body: t(`notifications.${kind}.body`, values),
      };
    case 'class_cancelled':
      return {
        title: t('notifications.class_cancelled.title'),
        body: params['reason']
          ? t('notifications.class_cancelled.bodyWithReason', values)
          : t('notifications.class_cancelled.body', values),
      };
    case 'workout_published':
      return {
        title: t('notifications.workout_published.title', values),
        body: params['title']
          ? t('notifications.workout_published.body', values)
          : t('notifications.workout_published.bodyWithoutTitle', values),
      };
    case 'membership_due':
      return {
        title: t('notifications.membership_due.title'),
        body: params['dueToday']
          ? t('notifications.membership_due.bodyToday', values)
          : t('notifications.membership_due.body', values),
      };
    case 'card_payment_failed':
      return {
        title: t('notifications.card_payment_failed.title'),
        body: params['finalAttempt']
          ? t('notifications.card_payment_failed.bodyFinal', values)
          : t('notifications.card_payment_failed.body', values),
      };
    case 'membership_overdue':
      return {
        title: t('notifications.membership_overdue.title'),
        body: t('notifications.membership_overdue.body', values),
      };
    case 'staff_class_cancelled': {
      const count = Number(params['count'] ?? 0);
      const variant = count === 0 ? 'bodyNone' : count === 1 ? 'bodyOne' : 'body';
      return {
        title: t('notifications.staff_class_cancelled.title', values),
        body: t(`notifications.staff_class_cancelled.${variant}`, values),
      };
    }
    case 'staff_overdue_digest':
      return {
        title: t('notifications.staff_overdue_digest.title', values),
        body:
          Number(params['count']) === 1
            ? t('notifications.staff_overdue_digest.bodyOne', values)
            : t('notifications.staff_overdue_digest.body', values),
      };
  }
}

/** Where tapping the notification goes: a member app path, or the admin panel for staff. */
const MEMBER_PATHS: Partial<Record<NotificationKind, string>> = {
  booking_confirmed: '/reservar',
  waitlist_promoted: '/reservar',
  class_cancelled: '/reservar',
  workout_published: '/wod',
  membership_due: '/perfil',
  membership_overdue: '/perfil',
  card_payment_failed: '/cuota',
};
const ADMIN_PATHS: Partial<Record<NotificationKind, string>> = {
  staff_class_cancelled: '/clases',
  staff_overdue_digest: '/cobros',
};

/** The message for one person on one channel, in es-PY. Pure, so retries resend the same text. */
export function renderNotification(
  kind: NotificationKind,
  params: NotificationParams,
  channel: NotificationChannel,
  context: RenderContext,
): RenderedNotification {
  const message: RenderedNotification = texts(kind, params, context.boxName);
  const memberPath = MEMBER_PATHS[kind];
  const adminPath = ADMIN_PATHS[kind];
  if (memberPath && channel === 'push') message.url = memberPath;
  if (adminPath && context.adminAppUrl) message.url = `${context.adminAppUrl}${adminPath}`;
  const tag = params['tag'];
  if (typeof tag === 'string') message.tag = tag;
  const template = WHATSAPP_TEMPLATES[kind];
  if (channel === 'whatsapp' && template) {
    const values: NotificationParams = {
      ...params,
      box: context.boxName,
      firstName: context.firstName,
    };
    message.whatsappTemplate = {
      name: template.name,
      language: context.whatsappLanguage,
      parameters: template.parameters.map((name) => textOf(values, name)),
    };
  }
  return message;
}
