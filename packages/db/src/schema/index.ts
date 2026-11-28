// One file per domain. Every table holding a box's data has `box_id`, a
// `tenant_isolation` RLS policy and composite foreign keys (see CLAUDE.md, Seguridad).
export * from './enums';
export * from './rls';
export * from './platform';
export * from './auth';
export * from './imports';
export * from './features';
export * from './ai';
export * from './locations';
export * from './brodi';
export * from './people';
export * from './plans';
export * from './classes';
export * from './workouts';
export * from './billing';
export * from './card-payments';
export * from './audit';
export * from './notifications';
