import {
  PLATFORM_BOX_FILTERS,
  type PlatformBoxFilter,
  type PlatformBoxSummary,
  t,
} from '@guaranix/shared';
import {
  Button,
  Card,
  ChipGroup,
  EmptyState,
  Page,
  PageHeader,
  Skeleton,
  TextField,
} from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { Plus, SearchX } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useBoxes } from '../../api/queries';
import { BoxActionSheet, type ReasonAction } from './BoxActionSheet';
import { BoxesTable } from './BoxesTable';
import { MetricsRow } from './MetricsRow';
import { NewBoxSheet } from './NewBoxSheet';

const FILTER_OPTIONS = PLATFORM_BOX_FILTERS.map((value) => ({
  value,
  label: t(`platform.boxes.filters.${value}`),
}));

const isFilter = (value: string | null): value is PlatformBoxFilter =>
  (PLATFORM_BOX_FILTERS as readonly string[]).includes(value ?? '');

function BoxList({
  status,
  search,
  onOpen,
  onEnter,
}: {
  status: PlatformBoxFilter;
  search: string;
  onOpen: (box: PlatformBoxSummary) => void;
  onEnter: (box: PlatformBoxSummary) => void;
}) {
  const { data: boxes, error, refetch } = useBoxes(status, search);
  if (error) {
    return (
      <EmptyState
        title={t('platform.boxes.loadError')}
        description={errorText(error)}
        action={
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }
  if (!boxes) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-12 rounded-md" />
        ))}
      </div>
    );
  }
  if (boxes.length === 0) {
    const filtered = status !== 'all' || search !== '';
    return (
      <EmptyState
        {...(filtered ? { icon: SearchX } : {})}
        title={t(filtered ? 'platform.boxes.empty.title' : 'platform.boxes.firstEmpty.title')}
        description={t(
          filtered ? 'platform.boxes.empty.description' : 'platform.boxes.firstEmpty.description',
        )}
      />
    );
  }
  return <BoxesTable boxes={boxes} onOpen={onOpen} onEnter={onEnter} />;
}

export function BoxesScreen() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<{
    box: Pick<PlatformBoxSummary, 'id' | 'name'>;
    action: ReasonAction;
  } | null>(null);
  const status = isFilter(params.get('estado'))
    ? (params.get('estado') as PlatformBoxFilter)
    : 'all';
  // Old links opened the box in a side panel (`?box=`); it has its own page now.
  const legacyBoxId = params.get('box');

  const update = (changes: Record<string, string | null>) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === 'all') next.delete(key);
        else next.set(key, value);
      }
      return next;
    });

  if (legacyBoxId) return <Navigate replace to={`/box/${legacyBoxId}`} />;

  return (
    <Page layout="panel">
      <PageHeader
        size="large"
        title={t('platform.boxes.title')}
        subtitle={t('platform.boxes.subtitle')}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" size={18} />
            {t('platform.boxes.new')}
          </Button>
        }
      />
      <MetricsRow />
      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <ChipGroup
            label={t('platform.boxes.filtersLabel')}
            options={FILTER_OPTIONS}
            value={status}
            onChange={(value) => update({ estado: value })}
          />
          <TextField
            label={t('platform.boxes.search')}
            type="search"
            className="lg:w-72"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <BoxList
          status={status}
          search={deferredSearch}
          onOpen={(box) => void navigate(`/box/${box.id}`)}
          onEnter={(box) => setPending({ box, action: 'impersonate' })}
        />
      </Card>

      {pending ? (
        <BoxActionSheet
          box={pending.box}
          action={pending.action}
          onClose={() => setPending(null)}
        />
      ) : null}
      <NewBoxSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(boxId) => void navigate(`/box/${boxId}`)}
      />
    </Page>
  );
}
