import {
  BOOKING_STATUSES,
  BOX_ROLES,
  BOX_STATUSES,
  BUSINESS_TYPES,
  CHARGE_STATUSES,
  CLASS_STATUSES,
  IMPORT_SOURCES,
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
