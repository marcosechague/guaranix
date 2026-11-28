import {
  formatGuarani,
  MEMBER_IMPORT_FIELDS,
  t,
  type ImportIssue,
  type ImportRowOutcome,
  type MemberImportField,
} from '@guaranix/shared';
import { Badge, DividedList, ChipGroup, type BadgeTone } from '@guaranix/ui';
import { CircleAlert, Info } from 'lucide-react';
import { useState } from 'react';
import { formatCalendarDate } from './format';

type Filter = 'all' | 'errors' | 'warnings';

// Rendering thousands of rows at once would make a front-desk phone stutter.
const VISIBLE_ROWS = 200;

const STATUS_TONE: Record<ImportRowOutcome['status'], BadgeTone> = {
  new: 'success',
  existing: 'neutral',
  invalid: 'warning',
};

// Informational warnings that every matched member gets; not worth a filter hit.
const ROUTINE_WARNINGS = new Set(['member_exists']);

function matches(row: ImportRowOutcome, filter: Filter): boolean {
  if (filter === 'errors') return row.errors.length > 0;
  if (filter === 'warnings') return row.warnings.some((issue) => !ROUTINE_WARNINGS.has(issue.code));
  return true;
}

const isMemberField = (field: ImportIssue['field']): field is MemberImportField =>
  (MEMBER_IMPORT_FIELDS as readonly (string | null)[]).includes(field);

function IssueLine({ issue, tone }: { issue: ImportIssue; tone: 'error' | 'warning' }) {
  const Icon = tone === 'error' ? CircleAlert : Info;
  const field = isMemberField(issue.field) ? t(`admin.imports.memberFields.${issue.field}`) : null;
  return (
    <li
      className={
        tone === 'error'
          ? 'flex gap-2 text-sm text-warning'
          : 'flex gap-2 text-sm text-text-secondary'
      }
    >
      <Icon aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
      <span>
        {field ? <span className="font-medium">{field}: </span> : null}
        {t(`admin.imports.issues.${issue.code}`)}
      </span>
    </li>
  );
}

function RowItem({ row, line }: { row: ImportRowOutcome; line: number }) {
  const name = row.member ? `${row.member.firstName} ${row.member.lastName}` : null;
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm text-text-secondary tabular-nums">
          {t('admin.imports.preview.line', { line })}
        </span>
        <span className="font-semibold">{name ?? t('admin.imports.preview.noName')}</span>
        <Badge tone={STATUS_TONE[row.status]} dot>
          {t(`admin.imports.preview.status.${row.status}`)}
        </Badge>
      </div>
      {row.plan || row.balance ? (
        <p className="text-sm text-text-soft">
          {row.plan
            ? t('admin.imports.preview.planLine', {
                plan: row.plan.planName,
                from: formatCalendarDate(row.plan.startsOn),
                to: formatCalendarDate(row.plan.endsOn),
              })
            : null}
          {row.plan?.classesRemaining !== null && row.plan?.classesRemaining !== undefined
            ? ` · ${t('admin.imports.preview.credits', { count: row.plan.classesRemaining })}`
            : null}
          {row.balance
            ? `${row.plan ? ' · ' : ''}${t('admin.imports.preview.balanceLine', { amount: formatGuarani(row.balance.amountGs) })}`
            : null}
        </p>
      ) : null}
      {row.errors.length + row.warnings.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {row.errors.map((issue, index) => (
            <IssueLine key={`e${index}`} issue={issue} tone="error" />
          ))}
          {row.warnings.map((issue, index) => (
            <IssueLine key={`w${index}`} issue={issue} tone="warning" />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function PreviewRows({ rows, lines }: { rows: ImportRowOutcome[]; lines: number[] }) {
  const [filter, setFilter] = useState<Filter>(
    rows.some((row) => row.errors.length > 0) ? 'errors' : 'all',
  );
  const filtered = rows.filter((row) => matches(row, filter));
  const visible = filtered.slice(0, VISIBLE_ROWS);

  return (
    <div className="flex flex-col gap-3">
      <ChipGroup
        label={t('admin.imports.preview.filterLabel')}
        value={filter}
        onChange={setFilter}
        options={(['all', 'errors', 'warnings'] as const).map((value) => ({
          value,
          label: t(`admin.imports.preview.filters.${value}`),
        }))}
      />
      {visible.length === 0 ? (
        <p className="py-4 text-sm text-text-secondary">
          {t('admin.imports.preview.noneMatching')}
        </p>
      ) : (
        <DividedList>
          {visible.map((row) => (
            <RowItem key={row.index} row={row} line={lines[row.index] ?? row.index + 2} />
          ))}
        </DividedList>
      )}
      {filtered.length > visible.length ? (
        <p className="text-sm text-text-secondary">
          {t('admin.imports.preview.showing', { shown: visible.length, total: filtered.length })}
        </p>
      ) : null}
    </div>
  );
}
