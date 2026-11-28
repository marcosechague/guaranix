import { formatDayMonth, formatKilograms, formatScore, t } from '@guaranix/shared';
import type { WorkoutComponent } from '@guaranix/shared/api';
import { Button, renderResultCard, shareImage, useToast } from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';
import { Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SavedResult } from '../wod/ResultCard';

export interface ShareResultButtonProps {
  component: WorkoutComponent;
  saved: SavedResult;
}

/**
 * The story-sized image is drawn as soon as the result is saved, so the tap
 * opens the share sheet right away (phones only allow it straight after a tap).
 */
export function ShareResultButton({ component, saved }: ShareResultButtonProps) {
  const { boxName, today } = useBoxClock();
  const toast = useToast();
  const [image, setImage] = useState<Blob | null>(null);
  const { result, isPersonalRecord } = saved;

  useEffect(() => {
    let current = true;
    const details = [
      result.scaling === 'rx' ? t('common.rx') : t('common.scaledLong'),
      ...(result.loadGrams !== null && component.scoreType !== 'load'
        ? [formatKilograms(result.loadGrams)]
        : []),
    ];
    renderResultCard({
      boxName: boxName ?? '',
      date: formatDayMonth(today),
      eyebrow: isPersonalRecord ? t('member.share.newPr') : t('member.share.wodResult'),
      title: component.title ?? t(`workout.kinds.${component.kind}`),
      score: formatScore(component.scoreType, result),
      details: [details.join(' · ')],
      withBrodi: isPersonalRecord,
    })
      .then((blob) => {
        if (current) setImage(blob);
      })
      .catch(() => {
        // No canvas: the button stays disabled, the result is saved anyway.
      });
    return () => {
      current = false;
    };
  }, [component, result, isPersonalRecord, boxName, today]);

  const share = async () => {
    if (!image) return;
    try {
      const outcome = await shareImage(image, `guaranix-${today}.png`);
      if (outcome === 'downloaded') toast.show(t('member.share.downloaded'));
    } catch {
      toast.show(t('member.share.failed'), 'error');
    }
  };

  return (
    <Button
      variant="secondary"
      className="h-14 rounded-xl"
      disabled={!image}
      onClick={() => void share()}
    >
      <Share2 aria-hidden="true" size={20} />
      {t('member.share.instagram')}
    </Button>
  );
}
