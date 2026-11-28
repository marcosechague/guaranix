import { type PlatformBoxSummary, t } from '@guaranix/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Page,
  PageHeader,
  Skeleton,
  TabBar,
  tabId,
  tabPanelId,
} from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { ArrowLeft, LogIn } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useBox } from '../../api/queries';
import { formatInstantDate, STATUS_TONES, statusLabel, trialLabel } from '../../lib/box-status';
import { BoxActionSheet, type ReasonAction } from './BoxActionSheet';
import { BoxActivity } from './BoxActivity';
import { BoxFeaturesSection } from './BoxFeaturesSection';
import { BoxSummaryTab } from './BoxSummaryTab';

const TABS = ['resumen', 'funciones', 'actividad'] as const;
type Tab = (typeof TABS)[number];
const TAB_OPTIONS = [
  { value: 'resumen', label: t('platform.box.tabs.summary') },
  { value: 'funciones', label: t('platform.box.tabs.features') },
  { value: 'actividad', label: t('platform.box.tabs.activity') },
] as const satisfies readonly { value: Tab; label: string }[];
const ID_PREFIX = 'box';

const isTab = (value: string | null): value is Tab =>
  (TABS as readonly string[]).includes(value ?? '');

function BoxStatusLine({ box }: { box: PlatformBoxSummary }) {
  const trial = trialLabel(box, new Date());
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <Badge tone={STATUS_TONES[box.status]} dot>
        {statusLabel(box.status)}
      </Badge>
      {trial ? <span>{trial} ·</span> : null}
      <span>{t('platform.box.since', { date: formatInstantDate(box.createdAt) })}</span>
    </span>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="-ml-2 inline-flex min-h-touch items-center gap-1.5 self-start rounded-sm px-2 text-sm font-semibold text-text-secondary hover:text-text"
    >
      <ArrowLeft aria-hidden="true" size={18} />
      {t('platform.box.back')}
    </Link>
  );
}

/** One box on its own page: who owns it, what it pays, what it can use and what happened. */
export function BoxScreen() {
  const { boxId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { data, error, refetch } = useBox(boxId);
  const [action, setAction] = useState<ReasonAction | null>(null);
  const tab: Tab = isTab(params.get('seccion')) ? (params.get('seccion') as Tab) : 'resumen';
  const box = data?.box;

  if (error) {
    return (
      <Page layout="panel">
        <BackLink />
        <EmptyState
          title={t('platform.box.notFound')}
          description={errorText(error)}
          action={
            <Button variant="secondary" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      </Page>
    );
  }

  if (!box || !data) {
    return (
      <Page layout="panel">
        <BackLink />
        <div aria-busy="true" className="flex flex-col gap-4">
          <Skeleton className="h-16 w-2/3 rounded-xl" />
          <Skeleton className="h-11 rounded-md" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </Page>
    );
  }

  return (
    <Page layout="panel" className="gap-5">
      <div className="flex flex-col gap-2">
        <BackLink />
        <PageHeader
          size="large"
          eyebrow={t(`platform.businessTypes.${box.businessType}`)}
          title={box.name}
          subtitle={<BoxStatusLine box={box} />}
          actions={
            <Button disabled={box.status === 'cancelled'} onClick={() => setAction('impersonate')}>
              <LogIn aria-hidden="true" size={18} />
              {t('platform.box.enterAs')}
            </Button>
          }
        />
        {box.statusReason && box.status !== 'active' && box.status !== 'trial' ? (
          <p className="self-start rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
            {t('platform.box.statusReason', { reason: box.statusReason })}
          </p>
        ) : null}
      </div>

      <TabBar
        label={t('platform.box.tabs.label')}
        idPrefix={ID_PREFIX}
        tabs={TAB_OPTIONS}
        value={tab}
        onChange={(next) =>
          setParams(next === 'resumen' ? {} : { seccion: next }, { replace: true })
        }
      />
      <div role="tabpanel" id={tabPanelId(ID_PREFIX, tab)} aria-labelledby={tabId(ID_PREFIX, tab)}>
        {tab === 'resumen' ? <BoxSummaryTab box={box} onAction={setAction} /> : null}
        {tab === 'funciones' ? <BoxFeaturesSection boxId={box.id} /> : null}
        {tab === 'actividad' ? (
          <Card>
            <BoxActivity activity={data.activity} />
          </Card>
        ) : null}
      </div>

      {action ? <BoxActionSheet box={box} action={action} onClose={() => setAction(null)} /> : null}
    </Page>
  );
}
