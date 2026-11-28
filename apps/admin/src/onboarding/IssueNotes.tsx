import type { SetupIssue } from '@guaranix/shared';
import { classNames } from '@guaranix/ui';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { issueText } from './issue-text';

/** The problems of one row, right under it, so the owner fixes them where they are. */
export function IssueNotes({ issues }: { issues: readonly SetupIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {issues.map((issue) => {
        const Icon = issue.severity === 'error' ? CircleAlert : TriangleAlert;
        return (
          <li
            key={`${issue.code}-${issue.path}`}
            className={classNames(
              'flex items-start gap-2 text-sm',
              issue.severity === 'error' ? 'text-warning' : 'text-text-soft',
            )}
          >
            <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{issueText(issue)}</span>
          </li>
        );
      })}
    </ul>
  );
}
