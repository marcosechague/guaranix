import { t } from '@guaranix/shared';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { IconButton } from './IconButton';

export interface NavCollapseButtonProps {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}

/** Shrinks a side menu to its icons, or opens it again. */
export function NavCollapseButton({ collapsed, onToggle, className }: NavCollapseButtonProps) {
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <IconButton
      variant="ghost"
      className={className}
      label={t(collapsed ? 'common.nav.expand' : 'common.nav.collapse')}
      aria-expanded={!collapsed}
      onClick={onToggle}
    >
      <Icon aria-hidden="true" size={19} strokeWidth={1.75} />
    </IconButton>
  );
}
