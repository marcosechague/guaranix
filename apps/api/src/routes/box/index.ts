import type { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { chargeRoutes, paymentRoutes, reportRoutes } from './billing';
import { bookingRoutes, meRoutes } from './bookings';
import { classRoutes, programRoutes, scheduleRoutes } from './classes';
import { aiImportRoutes } from './ai-imports';
import { importRoutes } from './imports';
import { memberRoutes } from './members';
import { memberPlanRoutes, planRoutes } from './plans';
import { receiptRoutes } from './receipts';
import { settingsRoutes } from './settings';
import { componentRoutes, movementRoutes, resultRoutes, workoutRoutes } from './workouts';

/** Box data under `/box/...`; every router checks the session's box and role. */
export function mountBoxRoutes(app: Hono<AppEnv>) {
  // First: it has no request-wide transaction, and a later `/box` router would open one.
  app.route('/box/ai-imports', aiImportRoutes);
  app.route('/box/members', memberRoutes);
  app.route('/box/plans', planRoutes);
  app.route('/box/member-plans', memberPlanRoutes);
  app.route('/box/programs', programRoutes);
  app.route('/box/schedules', scheduleRoutes);
  app.route('/box/classes', classRoutes);
  app.route('/box/bookings', bookingRoutes);
  app.route('/box/movements', movementRoutes);
  app.route('/box/workouts', workoutRoutes);
  app.route('/box/results', resultRoutes);
  app.route('/box/components', componentRoutes);
  app.route('/box/charges', chargeRoutes);
  app.route('/box/payments', paymentRoutes);
  app.route('/box/receipts', receiptRoutes);
  app.route('/box/reports', reportRoutes);
  app.route('/box/imports', importRoutes);
  app.route('/box/me', meRoutes);
  app.route('/box/settings', settingsRoutes);
}
