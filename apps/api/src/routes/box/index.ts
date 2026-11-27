import type { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { bookingRoutes, meRoutes } from './bookings';
import { classRoutes, programRoutes, scheduleRoutes } from './classes';
import { memberRoutes } from './members';
import { memberPlanRoutes, planRoutes } from './plans';

/** Box data under `/box/...`; every router runs inside the session's box scope. */
export function mountBoxRoutes(app: Hono<AppEnv>) {
  app.route('/box/members', memberRoutes);
  app.route('/box/plans', planRoutes);
  app.route('/box/member-plans', memberPlanRoutes);
  app.route('/box/programs', programRoutes);
  app.route('/box/schedules', scheduleRoutes);
  app.route('/box/classes', classRoutes);
  app.route('/box/bookings', bookingRoutes);
  app.route('/box/me', meRoutes);
}
