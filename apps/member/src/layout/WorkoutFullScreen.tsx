import { t } from '@guaranix/shared';
import { Badge, IconButton, ToastProvider } from '@guaranix/ui';
import { Volume2, VolumeX, X } from 'lucide-react';
import type { ReactNode } from 'react';

export interface WorkoutFullScreenProps {
  title: string;
  eyebrow?: string | undefined;
  badges?: readonly string[] | undefined;
  closeLabel: string;
  onClose(): void;
  sound: boolean;
  onToggleSound(): void;
  children: ReactNode;
}

/**
 * The timer and the guided WOD: full screen, always dark so it reads from the
 * floor, with only close and sound on top.
 */
export function WorkoutFullScreen({
  title,
  eyebrow,
  badges = [],
  closeLabel,
  onClose,
  sound,
  onToggleSound,
  children,
}: WorkoutFullScreenProps) {
  return (
    // Outside the app shell, so it brings its own toasts (e.g. "Resultado guardado").
    <ToastProvider>
      <div data-theme="dark" className="min-h-dvh bg-background text-text">
        <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-5 pt-5 pb-8 md:px-8">
          <header className="flex items-center gap-3">
            <IconButton label={closeLabel} onClick={onClose}>
              <X aria-hidden="true" size={20} />
            </IconButton>
            <div className="min-w-0 flex-1">
              {eyebrow ? (
                <p className="truncate text-xs font-semibold tracking-widest text-accent-text uppercase">
                  {eyebrow}
                </p>
              ) : null}
              <h1 className="truncate font-display text-lg font-bold">{title}</h1>
              {badges.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {badges.map((badge) => (
                    <Badge key={badge} tone="outline">
                      {badge}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
            <IconButton
              label={sound ? t('member.timer.mute') : t('member.timer.unmute')}
              onClick={onToggleSound}
            >
              {sound ? (
                <Volume2 aria-hidden="true" size={20} />
              ) : (
                <VolumeX aria-hidden="true" size={20} />
              )}
            </IconButton>
          </header>
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
