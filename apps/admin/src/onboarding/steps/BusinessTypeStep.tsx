import { BOX_TEMPLATES, BUSINESS_TYPES, type BusinessType, t } from '@guaranix/shared';
import { TileButton } from '@guaranix/ui';
import { Dumbbell, type LucideIcon, Sparkles, Swords } from 'lucide-react';
import { weeklyClassCount } from '../signup-draft';

const ICONS: Record<BusinessType, LucideIcon> = {
  functional_box: Dumbbell,
  pilates_studio: Sparkles,
  combat_gym: Swords,
};

export interface BusinessTypeStepProps {
  value: BusinessType | null;
  onChoose: (businessType: BusinessType) => void;
}

/** One tap picks the rubro and loads its template; the owner reviews it in the next steps. */
export function BusinessTypeStep({ value, onChoose }: BusinessTypeStepProps) {
  return (
    <div role="radiogroup" aria-label={t('onboarding.type.title')} className="grid gap-3">
      {BUSINESS_TYPES.map((businessType) => {
        const Icon = ICONS[businessType];
        const template = BOX_TEMPLATES[businessType];
        const selected = value === businessType;
        return (
          <TileButton
            key={businessType}
            role="radio"
            aria-checked={selected}
            selected={selected}
            onClick={() => onChoose(businessType)}
            className="flex-row items-center gap-4 p-4"
          >
            <span
              aria-hidden="true"
              className={
                selected
                  ? 'flex size-12 shrink-0 items-center justify-center rounded-md bg-accent text-on-accent'
                  : 'flex size-12 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-text'
              }
            >
              <Icon className="size-6" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-display text-lg font-bold">
                {t(`onboarding.type.options.${businessType}.title`)}
              </span>
              <span className="text-sm text-text-secondary">
                {t(`onboarding.type.options.${businessType}.description`)}
              </span>
              <span className="text-micro text-text-secondary">
                {t('onboarding.type.sample', {
                  programs: template.programs.map((program) => program.name).join(' y '),
                  slots: weeklyClassCount(template.slots),
                  plans: template.plans.length,
                })}
              </span>
            </span>
          </TileButton>
        );
      })}
    </div>
  );
}
