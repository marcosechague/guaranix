import { BOX_ROLES } from '@guaranix/shared';

// Same groups the services check, as non-empty tuples for `createBoxRouter`.
export const ANY_ROLE = BOX_ROLES;
export const STAFF = ['box_owner', 'box_admin', 'coach', 'reception'] as const;
export const MANAGERS = ['box_owner', 'box_admin'] as const;
export const FRONT_DESK = ['box_owner', 'box_admin', 'reception'] as const;
export const COACHING = ['box_owner', 'box_admin', 'coach'] as const;
export const MEMBERS_ONLY = ['member'] as const;
