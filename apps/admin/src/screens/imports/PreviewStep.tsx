import { formatGuarani, t } from '@guaranix/shared';
import { Button, Card, FormMessage, StatTile } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { useCommitImport, usePreviewImport, type CommitImportResult } from '../../api/imports';
import { buildRequest, type ImportDraft } from './import-draft';
import type { ReviewState } from './ImportScreen';
import { MissingPlansCard } from './MissingPlansCard';
import { PreviewRows } from './PreviewRows';

export interface PreviewStepProps {
  draft: ImportDraft;
  review: ReviewState;
  onReviewed: (review: ReviewState) => void;
  onBack: () => void;
  onCommitted: (result: CommitImportResult) => void;
}

export function PreviewStep({ draft, review, onReviewed, onBack, onCommitted }: PreviewStepProps) {
  const preview = usePreviewImport();
  const commit = useCommitImport();
  const { analysis } = review;
  const { summary } = analysis;
  const validRows = summary.rows - summary.invalidRows;
  const sheetErrors = analysis.plans.filter((plan) => plan.status === 'invalid');
  const hasErrors = summary.invalidRows > 0 || sheetErrors.length > 0;
  const nothingNew =
    summary.membersCreated +
      summary.plansCreated +
      summary.memberPlansCreated +
      summary.chargesCreated ===
    0;

  const request = (skipInvalidRows: boolean) =>
    buildRequest(draft, { balanceDescription: review.balanceDescription, skipInvalidRows });

  const reReview = () => {
    const { request: body, lines } = request(false);
    preview.mutate(body, { onSuccess: (next) => onReviewed({ ...review, analysis: next, lines }) });
  };

  const submit = () =>
    commit.mutate(request(hasErrors).request, { onSuccess: (result) => onCommitted(result) });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('admin.imports.preview.newMembers')} value={summary.membersCreated} />
        <StatTile
          label={t('admin.imports.preview.existingMembers')}
          value={summary.membersMatched}
        />
        <StatTile label={t('admin.imports.preview.invalidRows')} value={summary.invalidRows} />
        <StatTile
          className="col-span-2 lg:col-span-1"
          label={t('admin.imports.preview.balance')}
          value={formatGuarani(summary.balanceGs)}
          hint={t('admin.imports.preview.plansHint', {
            plans: summary.plansCreated,
            memberPlans: summary.memberPlansCreated,
          })}
        />
      </div>
      <MissingPlansCard analysis={analysis} onPlanCreated={reReview} />
      {sheetErrors.map((plan) => (
        <FormMessage key={plan.index} tone="error">
          {t('admin.imports.preview.planSheetErrors', { line: plan.index + 2 })}
        </FormMessage>
      ))}
      <Card>
        <PreviewRows rows={analysis.rows} lines={review.lines} />
      </Card>
      {hasErrors && validRows > 0 ? (
        <FormMessage tone="error">
          {t('admin.imports.preview.errorsNotice', { count: summary.invalidRows })}
        </FormMessage>
      ) : null}
      {nothingNew ? (
        <FormMessage tone="success">{t('admin.imports.preview.nothingNew')}</FormMessage>
      ) : null}
      {commit.isError ? <FormMessage tone="error">{errorText(commit.error)}</FormMessage> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={onBack}>
          {t('admin.imports.preview.back')}
        </Button>
        <Button
          disabled={nothingNew || validRows === 0 || commit.isPending || preview.isPending}
          onClick={submit}
        >
          {commit.isPending
            ? t('admin.imports.preview.committing')
            : hasErrors
              ? t('admin.imports.preview.commitValid', { count: validRows })
              : t('admin.imports.preview.commit', { count: validRows })}
        </Button>
      </div>
    </div>
  );
}
