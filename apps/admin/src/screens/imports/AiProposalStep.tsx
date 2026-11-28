import { MEMBER_IMPORT_FIELDS, PLAN_IMPORT_FIELDS, t } from '@guaranix/shared';
import { Button, Card, FormMessage, TextField } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import type { ImportDraft } from './import-draft';
import { useReviewDraft } from './use-review-draft';
import type { MappingStepProps } from './MappingStep';
import { ProposalRowList } from './ProposalRowList';

const NAME_FIELDS = ['fullName', 'firstName', 'lastName'] as const;

const withRows = (sheet: ImportDraft['members'], rows: string[][]) => ({
  ...sheet,
  rows: [sheet.rows[0] ?? [], ...rows],
});

/** Takes the place of column mapping for AI reads: the columns are known, the rows need a look. */
export function AiProposalStep({ draft, onChange, onBack, onReviewed }: MappingStepProps) {
  const { preview, balanceDescription, setBalanceDescription, review } = useReviewDraft(
    draft,
    onReviewed,
  );
  const memberRows = draft.members.rows.slice(1);
  const planRows = draft.plans?.rows.slice(1) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-text-soft">{t('admin.imports.ai.reviewHint')}</p>
      {memberRows.length > 0 ? (
        <ProposalRowList
          title={t('admin.imports.ai.membersTitle', { count: memberRows.length })}
          fields={MEMBER_IMPORT_FIELDS}
          labelOf={(field) => t(`admin.imports.memberFields.${field}`)}
          titleOf={(cells) =>
            cells.fullName || [cells.firstName, cells.lastName].filter(Boolean).join(' ')
          }
          titleFields={NAME_FIELDS}
          rows={memberRows}
          onChange={(rows) => onChange({ ...draft, members: withRows(draft.members, rows) })}
        />
      ) : (
        <FormMessage tone="error">{t('admin.imports.ai.noMembersLeft')}</FormMessage>
      )}
      {draft.plans && planRows.length > 0 ? (
        <ProposalRowList
          title={t('admin.imports.ai.plansTitle', { count: planRows.length })}
          fields={PLAN_IMPORT_FIELDS}
          labelOf={(field) => t(`admin.imports.planFields.${field}`)}
          titleOf={(cells) => cells.name ?? ''}
          titleFields={['name']}
          rows={planRows}
          onChange={(rows) =>
            onChange({ ...draft, plans: draft.plans ? withRows(draft.plans, rows) : null })
          }
        />
      ) : null}
      <Card>
        <TextField
          label={t('admin.imports.mapping.balanceDescription')}
          hint={t('admin.imports.mapping.balanceDescriptionHint')}
          value={balanceDescription}
          maxLength={200}
          onChange={(event) => setBalanceDescription(event.target.value)}
        />
      </Card>
      {preview.isError ? <FormMessage tone="error">{errorText(preview.error)}</FormMessage> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={onBack}>
          {t('admin.imports.ai.back')}
        </Button>
        <Button disabled={memberRows.length === 0 || preview.isPending} onClick={review}>
          {preview.isPending
            ? t('admin.imports.mapping.reviewing')
            : t('admin.imports.mapping.review')}
        </Button>
      </div>
    </div>
  );
}
