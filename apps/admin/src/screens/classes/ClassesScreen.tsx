import { formatDayMonth, startOfWeek, t, weekdayShort, dayOfMonth } from '@guaranix/shared';
import type { ClassListItem } from '@guaranix/shared/api';
import {
  ALL_LOCATIONS,
  Button,
  DayPicker,
  IconButton,
  LocationChips,
  Page,
  PageHeader,
  Skeleton,
  atLocation,
  locationsIn,
} from '@guaranix/ui';
import { LoadError, useBoxClock } from '@guaranix/ui/data';
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router';
import { canManage } from '../../lib/roles';
import { useState } from 'react';
import { useClasses } from '../../api/queries';
import { ClassRosterSheet } from './ClassRosterSheet';
import { WeekGrid } from './WeekGrid';
import { groupByDay, shiftWeek, weekDays } from './week';

export function ClassesScreen() {
  const { today, timeZone, role } = useBoxClock();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [selectedDay, setSelectedDay] = useState(today);
  const [openClassId, setOpenClassId] = useState<string | null>(null);
  const [location, setLocation] = useState(ALL_LOCATIONS);
  const days = weekDays(weekStart);
  const lastDay = days[6] ?? weekStart;
  const classes = useClasses(weekStart, lastDay);
  const byDay = groupByDay(atLocation(classes.data ?? [], location), timeZone);
  const showLocation = location === ALL_LOCATIONS && locationsIn(classes.data ?? []).length > 1;
  const openClass: ClassListItem | null =
    classes.data?.find((item) => item.id === openClassId) ?? null;

  const moveWeek = (weeks: number) => {
    const next = weeks === 0 ? startOfWeek(today) : shiftWeek(weekStart, weeks);
    setWeekStart(next);
    setSelectedDay(weeks === 0 ? today : next);
  };

  return (
    <Page layout="panel">
      <PageHeader
        size="large"
        title={t('admin.classes.title')}
        subtitle={t('admin.classes.subtitle', {
          from: formatDayMonth(weekStart),
          to: formatDayMonth(lastDay),
        })}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canManage(role) ? (
              <Button asChild variant="ghost">
                <Link to="/ajustes">
                  <SlidersHorizontal aria-hidden="true" size={18} />
                  {t('admin.classes.schedules')}
                </Link>
              </Button>
            ) : null}
            <IconButton label={t('admin.classes.previousWeek')} onClick={() => moveWeek(-1)}>
              <ChevronLeft aria-hidden="true" size={20} />
            </IconButton>
            <Button variant="secondary" onClick={() => moveWeek(0)}>
              {t('admin.classes.thisWeek')}
            </Button>
            <IconButton label={t('admin.classes.nextWeek')} onClick={() => moveWeek(1)}>
              <ChevronRight aria-hidden="true" size={20} />
            </IconButton>
          </div>
        }
      />
      <LocationChips
        label={t('locations.filter')}
        allLabel={t('locations.all')}
        items={classes.data ?? []}
        value={location}
        onChange={setLocation}
      />
      <DayPicker
        className="lg:hidden"
        label={t('admin.classes.day')}
        value={selectedDay}
        onChange={setSelectedDay}
        days={days.map((day) => ({
          value: day,
          weekday: weekdayShort(day),
          day: dayOfMonth(day),
          marked: (byDay.get(day)?.length ?? 0) > 0,
        }))}
      />
      {classes.isPending ? (
        <div aria-busy="true" className="grid gap-3 lg:grid-cols-7">
          {[0, 1, 2, 3, 4, 5, 6].map((index) => (
            <Skeleton key={index} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : classes.isError ? (
        <LoadError error={classes.error} onRetry={() => void classes.refetch()} />
      ) : (
        <WeekGrid
          days={days}
          today={today}
          selectedDay={selectedDay}
          byDay={byDay}
          timeZone={timeZone}
          showLocation={showLocation}
          onOpen={setOpenClassId}
        />
      )}
      <ClassRosterSheet item={openClass} onClose={() => setOpenClassId(null)} />
    </Page>
  );
}
