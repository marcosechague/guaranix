import { type KeyboardEvent, useRef } from 'react';
import { classNames } from '../lib/class-names';
import type { Option } from './OptionGroup';

export interface TabBarProps<T extends string> {
  label: string;
  tabs: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Prefix for the ids that tie each tab to its panel (`${idPrefix}-panel-${value}`). */
  idPrefix: string;
  className?: string | undefined;
}

export const tabPanelId = (idPrefix: string, value: string) => `${idPrefix}-panel-${value}`;
export const tabId = (idPrefix: string, value: string) => `${idPrefix}-tab-${value}`;

/**
 * Underlined tabs that split one long screen into sections ("Resumen · Funciones").
 * Arrow keys move between tabs, as the WAI-ARIA tabs pattern asks.
 */
export function TabBar<T extends string>({
  label,
  tabs,
  value,
  onChange,
  idPrefix,
  className,
}: TabBarProps<T>) {
  const list = useRef<HTMLDivElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.value === value);
    const next = tabs[(index + step + tabs.length) % tabs.length];
    if (!next) return;
    onChange(next.value);
    list.current?.querySelector<HTMLButtonElement>(`#${tabId(idPrefix, next.value)}`)?.focus();
  }

  return (
    <div
      ref={list}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={classNames('flex gap-1 overflow-x-auto border-b border-divider', className)}
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            id={tabId(idPrefix, tab.value)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={tabPanelId(idPrefix, tab.value)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={classNames(
              '-mb-px min-h-touch shrink-0 border-b-2 px-3 text-sm font-semibold',
              'transition-[color,border-color] duration-fast ease-out',
              selected
                ? 'border-text text-text'
                : 'border-transparent text-text-secondary hover:text-text',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
