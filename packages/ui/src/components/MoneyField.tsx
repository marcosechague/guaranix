import { formatGuarani } from '@guaranix/shared';
import { type ChangeEvent, useState } from 'react';
import { TextField, type TextFieldProps } from './TextField';

export interface MoneyFieldProps extends Omit<
  TextFieldProps,
  'value' | 'onChange' | 'type' | 'inputMode' | 'defaultValue'
> {
  /** Whole guaraníes; null while empty. */
  value: number | null;
  onValueChange: (value: number | null) => void;
}

const digitsOf = (text: string) => text.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

/** Guaraní amount typed as digits and shown with thousand dots: "350.000". */
export function MoneyField({ value, onValueChange, onBlur, ...props }: MoneyFieldProps) {
  const [focused, setFocused] = useState(false);
  const shown = value === null ? '' : formatGuarani(value).replace('₲ ', '');

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = digitsOf(event.target.value).slice(0, 12);
    onValueChange(digits === '' ? null : Number(digits));
  }

  return (
    <TextField
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={focused ? shown : shown && `₲ ${shown}`}
      onFocus={(event) => {
        setFocused(true);
        // The text changes from "₲ 350.000" to "350.000" on focus; select it again so typing replaces it.
        const input = event.currentTarget;
        requestAnimationFrame(() => input.select());
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      onChange={handleChange}
    />
  );
}
