import { t } from '@guaranix/shared';
import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { IconButton } from './IconButton';

export interface CopyValueProps {
  label: string;
  value: string;
}

const COPIED_FOR_MS = 1500;

/** A labelled value with a copy button, for pasting an account or alias in the bank app. */
export function CopyValue({ label, value }: CopyValueProps) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FOR_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    void navigator.clipboard?.writeText(value).then(() => setCopied(true));
  };
  const Icon = copied ? Check : Copy;

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs text-text-secondary">{label}</span>
        <span className="font-medium break-words text-text">{value}</span>
      </div>
      <IconButton
        variant="ghost"
        label={t('payments.details.copy', { label })}
        onClick={copy}
        className={copied ? 'text-success' : undefined}
      >
        <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
      </IconButton>
      <span role="status" className="sr-only">
        {copied ? t('payments.details.copied') : ''}
      </span>
    </div>
  );
}
