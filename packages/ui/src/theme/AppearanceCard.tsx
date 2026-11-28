import { t } from '@guaranix/shared';
import { Card } from '../components/Card';
import { ThemePicker } from './ThemeControls';

/** Light, dark or automatic, on the profile or account screen of each app. */
export function AppearanceCard() {
  return (
    <Card aria-labelledby="appearance-title">
      <h2 id="appearance-title" className="font-display text-lg font-bold">
        {t('common.theme.label')}
      </h2>
      <p className="text-sm text-text-secondary">{t('common.theme.hint')}</p>
      <ThemePicker className="w-full" />
    </Card>
  );
}
