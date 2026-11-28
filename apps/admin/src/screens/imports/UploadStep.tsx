import { MAX_IMPORT_MEMBER_ROWS, t } from '@guaranix/shared';
import { Button, Card, Eyebrow, FileDropZone } from '@guaranix/ui';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { createDraft, type ImportDraft } from './import-draft';
import { ImportHistory } from './ImportHistory';
import { readSpreadsheet, SPREADSHEET_ACCEPT } from './read-spreadsheet';

type ReadError = 'unreadable' | 'empty' | 'tooMany';

const HOW_TO = ['howRows', 'howColumns', 'howPlan', 'howBalance', 'howPlansSheet'] as const;

function templateHref(): string {
  const csv = `${t('admin.imports.upload.templateHeaders')}\n${t('admin.imports.upload.templateExample')}\n`;
  // The byte-order mark makes Excel open the accents correctly.
  return `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${csv}`)}`;
}

export function UploadStep({ onRead }: { onRead: (draft: ImportDraft) => void }) {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<ReadError | null>(null);

  const read = async (file: File) => {
    setReading(true);
    setError(null);
    try {
      const draft = createDraft(file.name, await readSpreadsheet(file));
      if (!draft) setError('empty');
      else if (draft.members.rows.length - 1 > MAX_IMPORT_MEMBER_ROWS) setError('tooMany');
      else onRead(draft);
    } catch {
      setError('unreadable');
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="flex flex-col gap-6 lg:col-span-3">
        <Card>
          <FileDropZone
            label={
              reading ? t('admin.imports.upload.reading') : t('admin.imports.upload.dropLabel')
            }
            hint={t('admin.imports.upload.dropHint')}
            accept={SPREADSHEET_ACCEPT}
            disabled={reading}
            error={error ? t(`admin.imports.upload.${error}`) : undefined}
            onFile={(file) => void read(file)}
          />
        </Card>
        <ImportHistory />
      </div>
      <Card className="lg:col-span-2">
        <Eyebrow>{t('admin.imports.upload.howTitle')}</Eyebrow>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-text-soft">
          {HOW_TO.map((key) => (
            <li key={key}>{t(`admin.imports.upload.${key}`)}</li>
          ))}
        </ul>
        <Button asChild variant="secondary">
          <a href={templateHref()} download={t('admin.imports.upload.templateFileName')}>
            <Download aria-hidden="true" size={18} />
            {t('admin.imports.upload.template')}
          </a>
        </Button>
      </Card>
    </div>
  );
}
