import { t, type ImportAnalysis } from '@guaranix/shared';
import { Page, PageHeader } from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';
import { useState } from 'react';
import { Navigate } from 'react-router';
import type { CommitImportResult } from '../../api/imports';
import { canManage } from '../../lib/roles';
import { DoneStep } from './DoneStep';
import type { ImportDraft } from './import-draft';
import { MappingStep } from './MappingStep';
import { PreviewStep } from './PreviewStep';
import { StepIndicator } from './StepIndicator';
import { UploadStep } from './UploadStep';

export interface ReviewState {
  analysis: ImportAnalysis;
  lines: number[];
  balanceDescription: string;
}

type Step =
  | { name: 'upload' }
  | { name: 'map'; draft: ImportDraft }
  | { name: 'preview'; draft: ImportDraft; review: ReviewState }
  | { name: 'done'; result: CommitImportResult };

const STEP_INDEX = { upload: 0, map: 1, preview: 2, done: 2 } as const;

/** Upload → map columns → review row by row → import. Nothing is saved before the last step. */
export function ImportScreen() {
  const { role } = useBoxClock();
  const [step, setStep] = useState<Step>({ name: 'upload' });
  if (role !== undefined && !canManage(role)) return <Navigate to="/alumnos" replace />;

  return (
    <Page layout="panel">
      <PageHeader
        size="large"
        title={t('admin.imports.title')}
        subtitle={t('admin.imports.subtitle')}
      />
      <StepIndicator current={STEP_INDEX[step.name]} done={step.name === 'done'} />
      {step.name === 'upload' ? (
        <UploadStep onRead={(draft) => setStep({ name: 'map', draft })} />
      ) : step.name === 'map' ? (
        <MappingStep
          draft={step.draft}
          onChange={(draft) => setStep({ name: 'map', draft })}
          onBack={() => setStep({ name: 'upload' })}
          onReviewed={(review) => setStep({ name: 'preview', draft: step.draft, review })}
        />
      ) : step.name === 'preview' ? (
        <PreviewStep
          draft={step.draft}
          review={step.review}
          onReviewed={(review) => setStep({ ...step, review })}
          onBack={() => setStep({ name: 'map', draft: step.draft })}
          onCommitted={(result) => setStep({ name: 'done', result })}
        />
      ) : (
        <DoneStep result={step.result} onAnother={() => setStep({ name: 'upload' })} />
      )}
    </Page>
  );
}
