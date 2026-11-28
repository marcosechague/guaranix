import { t } from '@guaranix/shared';
import { Moon, Sun } from 'lucide-react';
import { IconButton } from '../components/IconButton';
import { SegmentedControl } from '../components/SegmentedControl';
import { type ThemePreference, useTheme } from './preference';

/** System, light or dark, for a settings or profile screen. */
export function ThemePicker({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  return (
    <SegmentedControl<ThemePreference>
      label={t('common.theme.label')}
      className={className}
      value={preference}
      onChange={setPreference}
      options={[
        { value: 'system', label: t('common.theme.system') },
        { value: 'light', label: t('common.theme.light') },
        { value: 'dark', label: t('common.theme.dark') },
      ]}
    />
  );
}

/** One tap between light and dark, for a menu. */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { theme, setPreference } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <IconButton
      variant="ghost"
      className={className}
      label={t(next === 'dark' ? 'common.theme.toDark' : 'common.theme.toLight')}
      onClick={() => setPreference(next)}
    >
      <Icon aria-hidden="true" size={19} strokeWidth={1.75} />
    </IconButton>
  );
}
