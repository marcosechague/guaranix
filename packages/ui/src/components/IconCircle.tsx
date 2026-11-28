import type { LucideIcon } from 'lucide-react';

/** A quiet round icon that leads an empty state or a drop area. */
export function IconCircle({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-12 items-center justify-center rounded-pill bg-surface-sunken text-text-secondary">
      <Icon aria-hidden="true" size={22} />
    </span>
  );
}
