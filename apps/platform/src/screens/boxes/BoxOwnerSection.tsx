import { type PlatformBoxSummary, t } from '@guaranix/shared';
import { Badge, Button, CopyValue, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { KeyRound, UserRoundCog } from 'lucide-react';
import { useState } from 'react';
import { useBoxMutations } from '../../api/queries';
import { ADMIN_URL } from '../../config';
import { formatInstantDate } from '../../lib/box-status';
import { ChangeOwnerSheet } from './ChangeOwnerSheet';

export interface BoxOwnerSectionProps {
  box: PlatformBoxSummary;
}

const panelUrl = ADMIN_URL.endsWith('/') ? ADMIN_URL : `${ADMIN_URL}/`;

/** Who owns the box and what to send them so they can get in. */
export function BoxOwnerSection({ box }: BoxOwnerSectionProps) {
  const toast = useToast();
  const { createAccessLink } = useBoxMutations(box.id);
  const [changing, setChanging] = useState(false);
  const owner = box.owner;
  const link = createAccessLink.data;

  async function makeLink() {
    const created = await createAccessLink.mutateAsync(undefined);
    toast.show(
      t('platform.ownerAccess.linkCreated', { date: formatInstantDate(created.expiresAt) }),
      'success',
    );
  }

  const greeting = { name: owner?.fullName ?? '', box: box.name, email: owner?.email ?? '' };
  const accessUrl = link
    ? `${panelUrl}reset-password?token=${encodeURIComponent(link.token)}`
    : null;

  return (
    <div className="flex flex-col gap-3">
      {owner ? (
        <p className="flex flex-col">
          <span className="flex flex-wrap items-center gap-2 font-semibold">
            {owner.fullName}
            {owner.accessPending ? (
              <Badge tone="warning">{t('platform.ownerAccess.pending')}</Badge>
            ) : null}
          </span>
          <span className="text-sm text-text-secondary">{owner.email}</span>
        </p>
      ) : (
        <p className="text-sm text-text-secondary">{t('platform.box.noOwner')}</p>
      )}

      {owner?.accessPending ? (
        <div className="flex flex-col rounded-lg bg-surface-sunken px-3 py-1">
          <CopyValue label={t('platform.ownerAccess.panelLink')} value={panelUrl} />
          <CopyValue
            label={t('platform.ownerAccess.googleMessage')}
            value={t('platform.ownerAccess.googleText', { ...greeting, url: panelUrl })}
          />
          <p className="pb-2 text-xs text-text-secondary">
            {t('platform.ownerAccess.googleTestHint')}
          </p>
          {link && accessUrl ? (
            <CopyValue
              label={t('platform.ownerAccess.linkMessage')}
              value={t('platform.ownerAccess.linkText', {
                ...greeting,
                link: accessUrl,
                date: formatInstantDate(link.expiresAt),
              })}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {owner?.accessPending ? (
          <Button
            variant="secondary"
            disabled={createAccessLink.isPending}
            onClick={() =>
              void makeLink().catch((error: unknown) => toast.show(errorText(error), 'error'))
            }
          >
            <KeyRound aria-hidden="true" size={18} />
            {t('platform.ownerAccess.createLink')}
          </Button>
        ) : null}
        <Button variant="ghost" onClick={() => setChanging(true)}>
          <UserRoundCog aria-hidden="true" size={18} />
          {t('platform.ownerAccess.change')}
        </Button>
      </div>
      {owner?.accessPending ? (
        <p className="text-xs text-text-secondary">{t('platform.ownerAccess.createLinkHint')}</p>
      ) : null}
      {changing ? <ChangeOwnerSheet box={box} onClose={() => setChanging(false)} /> : null}
    </div>
  );
}
