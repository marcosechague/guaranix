import {
  BOOKING_STATUSES,
  BOX_ROLES,
  BOX_STATUSES,
  BUSINESS_TYPES,
  CHARGE_STATUSES,
  CLASS_STATUSES,
  IMPORT_SOURCES,
  FEATURE_FLAGS,
  AI_PROVIDERS,
  PAYMENT_ATTEMPT_KINDS,
  PAYMENT_ATTEMPT_STATUSES,
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_ENVIRONMENTS,
  SAVED_CARD_STATUSES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_STATUSES,
  NOTIFICATION_KINDS,
  NOTIFICATION_TOPICS,
  MEMBER_PLAN_STATUSES,
  MEMBER_STATUSES,
  MOVEMENT_CATEGORIES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PLAN_KINDS,
  SCALINGS,
  SCORE_TYPES,
  TIMER_TYPES,
  WORKOUT_COMPONENT_KINDS,
} from '@guaranix/shared/domain';
import { pgEnum } from 'drizzle-orm/pg-core';

export const boxRoleEnum = pgEnum('box_role', BOX_ROLES);
export const boxStatusEnum = pgEnum('box_status', BOX_STATUSES);
export const businessTypeEnum = pgEnum('business_type', BUSINESS_TYPES);
export const memberStatusEnum = pgEnum('member_status', MEMBER_STATUSES);
export const planKindEnum = pgEnum('plan_kind', PLAN_KINDS);
export const memberPlanStatusEnum = pgEnum('member_plan_status', MEMBER_PLAN_STATUSES);
export const classStatusEnum = pgEnum('class_status', CLASS_STATUSES);
export const bookingStatusEnum = pgEnum('booking_status', BOOKING_STATUSES);
export const workoutComponentKindEnum = pgEnum('workout_component_kind', WORKOUT_COMPONENT_KINDS);
export const scoreTypeEnum = pgEnum('score_type', SCORE_TYPES);
export const timerTypeEnum = pgEnum('timer_type', TIMER_TYPES);
export const scalingEnum = pgEnum('scaling', SCALINGS);
export const movementCategoryEnum = pgEnum('movement_category', MOVEMENT_CATEGORIES);
export const chargeStatusEnum = pgEnum('charge_status', CHARGE_STATUSES);
export const paymentMethodEnum = pgEnum('payment_method', PAYMENT_METHODS);
export const paymentStatusEnum = pgEnum('payment_status', PAYMENT_STATUSES);
export const importSourceEnum = pgEnum('import_source', IMPORT_SOURCES);
export const featureFlagEnum = pgEnum('feature_flag', FEATURE_FLAGS);
export const aiProviderEnum = pgEnum('ai_provider', AI_PROVIDERS);
export const paymentProviderEnum = pgEnum('payment_provider', PAYMENT_PROVIDERS);
export const paymentProviderEnvironmentEnum = pgEnum(
  'payment_provider_environment',
  PAYMENT_PROVIDER_ENVIRONMENTS,
);
export const paymentAttemptKindEnum = pgEnum('payment_attempt_kind', PAYMENT_ATTEMPT_KINDS);
export const paymentAttemptStatusEnum = pgEnum('payment_attempt_status', PAYMENT_ATTEMPT_STATUSES);
export const savedCardStatusEnum = pgEnum('saved_card_status', SAVED_CARD_STATUSES);
export const notificationChannelEnum = pgEnum('notification_channel', NOTIFICATION_CHANNELS);
export const notificationTopicEnum = pgEnum('notification_topic', NOTIFICATION_TOPICS);
export const notificationKindEnum = pgEnum('notification_kind', NOTIFICATION_KINDS);
export const notificationDeliveryStatusEnum = pgEnum(
  'notification_delivery_status',
  NOTIFICATION_DELIVERY_STATUSES,
);
