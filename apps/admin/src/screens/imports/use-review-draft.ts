import { t } from '@guaranix/shared';
import { useState } from 'react';
import { usePreviewImport } from '../../api/imports';
import { buildRequest, type ImportDraft } from './import-draft';
import type { ReviewState } from './ImportScreen';

/** Sends the draft to the dry-run preview, with the name the imported debts will carry. */
export function useReviewDraft(draft: ImportDraft, onReviewed: (review: ReviewState) => void) {
  const preview = usePreviewImport();
  const [balanceDescription, setBalanceDescription] = useState(
    t('admin.imports.mapping.balanceDescriptionDefault'),
  );

  const review = () => {
    const description =
      balanceDescription.trim() || t('admin.imports.mapping.balanceDescriptionDefault');
    const { request, lines } = buildRequest(draft, {
      balanceDescription: description,
      skipInvalidRows: false,
    });
    preview.mutate(request, {
      onSuccess: (analysis) => onReviewed({ analysis, lines, balanceDescription: description }),
    });
  };

  return { preview, balanceDescription, setBalanceDescription, review };
}
