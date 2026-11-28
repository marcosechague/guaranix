import { t, type AiImportStatus } from '@guaranix/shared';
import { Brodi, Card, FileDropZone } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { useState } from 'react';
import { useAiImportStatus, useExtractWithAi } from '../../api/ai-imports';
import { draftFromProposal, type ImportDraft } from './import-draft';
import { AI_FILE_ACCEPT, AiFileTooLargeError, prepareAiFile } from './prepare-ai-file';

type LocalError = 'tooLarge' | 'unreadable' | 'nothingFound';

function usesLeft(status: AiImportStatus): number | null {
  return status.monthlyLimit === null
    ? null
    : Math.max(0, status.monthlyLimit - status.usedThisMonth);
}

function UsesLine({ status }: { status: AiImportStatus }) {
  const left = usesLeft(status);
  return (
    <p className="text-sm text-text-secondary">
      {left === null
        ? t('admin.imports.ai.unlimited')
        : left === 0
          ? t('admin.imports.ai.limitReached', { limit: status.monthlyLimit ?? 0 })
          : t('admin.imports.ai.remaining', { count: left })}
    </p>
  );
}

/** Shown only when the box's plan includes AI import. */
export function AiReadCard({ onRead }: { onRead: (draft: ImportDraft) => void }) {
  const status = useAiImportStatus();
  const extract = useExtractWithAi();
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState<LocalError | null>(null);
  if (!status.data?.enabled) return null;

  const busy = preparing || extract.isPending;
  const exhausted = usesLeft(status.data) === 0;

  const read = async (file: File) => {
    setLocalError(null);
    extract.reset();
    setPreparing(true);
    let request;
    try {
      request = await prepareAiFile(file);
    } catch (error) {
      setLocalError(error instanceof AiFileTooLargeError ? 'tooLarge' : 'unreadable');
      return;
    } finally {
      setPreparing(false);
    }
    extract.mutate(request, {
      onSuccess: (proposal) => {
        const draft = draftFromProposal(file.name, proposal);
        if (draft) onRead(draft);
        else setLocalError('nothingFound');
      },
    });
  };

  const error = localError
    ? t(`admin.imports.ai.${localError}`)
    : extract.isError
      ? errorText(extract.error)
      : undefined;

  return (
    <Card>
      <div className="flex items-start gap-4">
        <Brodi alt="" size={64} className="shrink-0" />
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-semibold">{t('admin.imports.ai.title')}</h2>
          <p className="text-sm text-text-soft">{t('admin.imports.ai.body')}</p>
          <UsesLine status={status.data} />
        </div>
      </div>
      <FileDropZone
        label={busy ? t('admin.imports.ai.reading') : t('admin.imports.ai.dropLabel')}
        hint={t('admin.imports.ai.dropHint')}
        accept={AI_FILE_ACCEPT}
        disabled={busy || exhausted}
        error={error}
        onFile={(file) => void read(file)}
      />
      <p className="text-xs text-text-secondary">{t('admin.imports.ai.privacy')}</p>
    </Card>
  );
}
