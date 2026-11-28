import { X } from 'lucide-react';
import { IconButton } from './IconButton';

export interface FullScreenHeaderProps {
  eyebrow: string;
  title: string;
  closeLabel: string;
  onClose: () => void;
}

/** The top of a full-screen step (entry QR, wall check-in): a way out, where you are and what this is. */
export function FullScreenHeader({ eyebrow, title, closeLabel, onClose }: FullScreenHeaderProps) {
  return (
    <header className="flex items-center gap-3">
      <IconButton label={closeLabel} onClick={onClose}>
        <X aria-hidden="true" size={20} />
      </IconButton>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold tracking-widest text-text-secondary uppercase">
          {eyebrow}
        </p>
        <h1 className="truncate font-display text-xl font-bold">{title}</h1>
      </div>
    </header>
  );
}
