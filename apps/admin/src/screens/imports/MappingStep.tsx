import { IMPORT_SOURCES, MEMBER_IMPORT_FIELDS, PLAN_IMPORT_FIELDS, t } from '@guaranix/shared';
import { Button, Card, FormMessage, SegmentedControl, TextField } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { ColumnMappingCard } from './ColumnMappingCard';
import { mappingHasName, type ImportDraft } from './import-draft';
import type { ReviewState } from './ImportScreen';
import { useReviewDraft } from './use-review-draft';

export interface MappingStepProps {
  draft: ImportDraft;
  onChange: (draft: ImportDraft) => void;
  onBack: () => void;
  onReviewed: (review: ReviewState) => void;
}

// The AI source is set by the AI-assisted flow, not chosen here.
const FILE_SOURCES = IMPORT_SOURCES.filter((source) => source !== 'ai');

export function MappingStep({ draft, onChange, onBack, onReviewed }: MappingStepProps) {
  const { preview, balanceDescription, setBalanceDescription, review } = useReviewDraft(
    draft,
    onReviewed,
  );
  const hasName = mappingHasName(draft.memberMapping);

  return (
    <div className="flex flex-col gap-6">
      <ColumnMappingCard
        title={t('admin.imports.mapping.membersTitle')}
        hint={t('admin.imports.mapping.membersHint', { sheet: draft.members.name })}
        sheet={draft.members}
        fields={MEMBER_IMPORT_FIELDS}
        labelOf={(field) => t(`admin.imports.memberFields.${field}`)}
        mapping={draft.memberMapping}
        onChange={(memberMapping) => onChange({ ...draft, memberMapping })}
      />
      {draft.plans ? (
        <ColumnMappingCard
          title={t('admin.imports.mapping.plansTitle')}
          hint={t('admin.imports.mapping.plansHint', { sheet: draft.plans.name })}
          sheet={draft.plans}
          fields={PLAN_IMPORT_FIELDS}
          labelOf={(field) => t(`admin.imports.planFields.${field}`)}
          mapping={draft.planMapping}
          onChange={(planMapping) => onChange({ ...draft, planMapping })}
        />
      ) : null}
      <Card>
        <div className="grid gap-4 md:grid-cols-2 md:items-end">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-soft">
              {t('admin.imports.mapping.sourceLabel')}
            </span>
            <SegmentedControl
              label={t('admin.imports.mapping.sourceLabel')}
              value={draft.source}
              onChange={(source) => onChange({ ...draft, source })}
              options={FILE_SOURCES.map((source) => ({
                value: source,
                label: t(`admin.imports.history.sources.${source}`),
              }))}
            />
          </div>
          <TextField
            label={t('admin.imports.mapping.balanceDescription')}
            hint={t('admin.imports.mapping.balanceDescriptionHint')}
            maxLength={200}
            value={balanceDescription}
            onChange={(event) => setBalanceDescription(event.target.value)}
          />
        </div>
      </Card>
      {!hasName ? (
        <FormMessage tone="error">{t('admin.imports.mapping.nameRequired')}</FormMessage>
      ) : null}
      {preview.isError ? <FormMessage tone="error">{errorText(preview.error)}</FormMessage> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={onBack}>
          {t('admin.imports.mapping.back')}
        </Button>
        <Button disabled={!hasName || preview.isPending} onClick={review}>
          {preview.isPending
            ? t('admin.imports.mapping.reviewing')
            : t('admin.imports.mapping.review')}
        </Button>
      </div>
    </div>
  );
}
