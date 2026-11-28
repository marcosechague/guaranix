import type { BusinessType } from '../domain/enums';
import type { BoxSetup } from './setup';

const WEEKDAYS = [1, 2, 3, 4, 5];

const FUNCTIONAL_MOVEMENTS: BoxSetup['movements'] = [
  ...['Back Squat', 'Front Squat', 'Overhead Squat', 'Deadlift', 'Clean', 'Power Clean']
    .concat(['Snatch', 'Power Snatch', 'Clean & Jerk', 'Push Press', 'Strict Press'])
    .concat(['Push Jerk', 'Thruster', 'Bench Press'])
    .map((name) => ({ name, category: 'weightlifting' as const })),
  ...['Pull-up', 'Chest to Bar', 'Muscle-up', 'Handstand Push-up', 'Toes to Bar']
    .concat(['Double Under', 'Burpee', 'Box Jump', 'Wall Ball'])
    .map((name) => ({ name, category: 'gymnastics' as const })),
  ...['Row', 'Run', 'Assault Bike', 'Ski Erg'].map((name) => ({
    name,
    category: 'monostructural' as const,
  })),
];

/**
 * Starting points offered at sign-up, one per business type, so a center is
 * usable in minutes. Names are data the box edits afterwards, not interface
 * text. Prices are reference values in guaraníes for Gran Asunción, late 2026,
 * to be reviewed with the pilots.
 */
export const BOX_TEMPLATES: Record<BusinessType, BoxSetup> = {
  functional_box: {
    programs: [
      { key: 'crossfit', name: 'CrossFit', color: '#D9F24A' },
      { key: 'openBox', name: 'Open Box', color: '#6EE7A0' },
    ],
    slots: [
      ...['06:00', '07:00', '08:00', '18:00', '19:00', '20:00'].map((startTime) => ({
        programKey: 'crossfit',
        startTime,
        weekdays: WEEKDAYS,
        durationMinutes: 60,
        capacity: 16,
      })),
      ...['08:00', '09:00'].map((startTime) => ({
        programKey: 'crossfit',
        startTime,
        weekdays: [6],
        durationMinutes: 60,
        capacity: 20,
      })),
      ...['09:00', '16:00'].map((startTime) => ({
        programKey: 'openBox',
        startTime,
        weekdays: WEEKDAYS,
        durationMinutes: 120,
        capacity: 10,
      })),
    ],
    plans: [
      { name: 'Ilimitado', kind: 'unlimited', priceGs: 350_000, durationDays: 30 },
      {
        name: '3 veces por semana',
        kind: 'weekly_limit',
        classesPerWeek: 3,
        priceGs: 280_000,
        durationDays: 30,
      },
      {
        name: '2 veces por semana',
        kind: 'weekly_limit',
        classesPerWeek: 2,
        priceGs: 230_000,
        durationDays: 30,
      },
      {
        name: 'Pack 10 clases',
        kind: 'class_pack',
        classCount: 10,
        priceGs: 300_000,
        durationDays: 60,
      },
      { name: 'Clase suelta', kind: 'drop_in', classCount: 1, priceGs: 50_000, durationDays: 7 },
      {
        name: 'Solo Open Box',
        kind: 'unlimited',
        priceGs: 200_000,
        durationDays: 30,
        programKeys: ['openBox'],
      },
    ],
    movements: FUNCTIONAL_MOVEMENTS,
  },
  pilates_studio: {
    programs: [
      { key: 'reformer', name: 'Pilates Reformer', color: '#D9F24A' },
      { key: 'mat', name: 'Mat Pilates', color: '#6EE7A0' },
    ],
    slots: [
      ...['07:00', '08:00', '09:00', '17:00', '18:00', '19:00'].map((startTime) => ({
        programKey: 'reformer',
        startTime,
        weekdays: WEEKDAYS,
        durationMinutes: 50,
        capacity: 6,
      })),
      ...['10:00', '20:00'].map((startTime) => ({
        programKey: 'mat',
        startTime,
        weekdays: [1, 3, 5],
        durationMinutes: 50,
        capacity: 12,
      })),
    ],
    plans: [
      {
        name: '2 veces por semana',
        kind: 'weekly_limit',
        classesPerWeek: 2,
        priceGs: 330_000,
        durationDays: 30,
      },
      {
        name: '3 veces por semana',
        kind: 'weekly_limit',
        classesPerWeek: 3,
        priceGs: 420_000,
        durationDays: 30,
      },
      {
        name: 'Pack 8 clases',
        kind: 'class_pack',
        classCount: 8,
        priceGs: 360_000,
        durationDays: 45,
      },
      { name: 'Clase suelta', kind: 'drop_in', classCount: 1, priceGs: 60_000, durationDays: 7 },
    ],
  },
  combat_gym: {
    programs: [
      { key: 'boxing', name: 'Boxeo', color: '#D9F24A' },
      { key: 'kickboxing', name: 'Kickboxing', color: '#FF8A5B' },
    ],
    slots: [
      ...['07:00', '18:00', '20:00'].map((startTime) => ({
        programKey: 'boxing',
        startTime,
        weekdays: WEEKDAYS,
        durationMinutes: 60,
        capacity: 20,
      })),
      {
        programKey: 'kickboxing',
        startTime: '19:00',
        weekdays: WEEKDAYS,
        durationMinutes: 60,
        capacity: 20,
      },
      {
        programKey: 'boxing',
        startTime: '09:00',
        weekdays: [6],
        durationMinutes: 90,
        capacity: 25,
      },
    ],
    plans: [
      { name: 'Ilimitado', kind: 'unlimited', priceGs: 250_000, durationDays: 30 },
      {
        name: '3 veces por semana',
        kind: 'weekly_limit',
        classesPerWeek: 3,
        priceGs: 200_000,
        durationDays: 30,
      },
      { name: 'Clase suelta', kind: 'drop_in', classCount: 1, priceGs: 35_000, durationDays: 7 },
    ],
  },
};
