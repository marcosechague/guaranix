import { MAX_BRODI_QUESTION_LENGTH, t } from '@guaranix/shared';
import { Button, TextField } from '@guaranix/ui';
import { SendHorizontal } from 'lucide-react';
import { type FormEvent, useState } from 'react';

export interface BrodiAskFormProps {
  onAsk: (question: string) => void;
  busy: boolean;
  disabled: boolean;
}

export function BrodiAskForm({ onAsk, busy, disabled }: BrodiAskFormProps) {
  const [question, setQuestion] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (text.length < 2 || busy) return;
    onAsk(text);
    setQuestion('');
  };
  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <TextField
        className="min-w-0 flex-1"
        label={t('admin.brodi.askLabel')}
        labelClassName="sr-only"
        placeholder={t('admin.brodi.askPlaceholder')}
        value={question}
        maxLength={MAX_BRODI_QUESTION_LENGTH}
        disabled={disabled}
        onChange={(event) => setQuestion(event.target.value)}
      />
      <Button type="submit" disabled={disabled || busy || question.trim().length < 2}>
        <SendHorizontal aria-hidden="true" size={18} />
        {t('admin.brodi.ask')}
      </Button>
    </form>
  );
}
