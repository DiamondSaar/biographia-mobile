/**
 * Форматирование дат - маленький файл специально, чтобы не тащить
 * тяжёлую библиотеку дат (moment/dayjs) ради одной функции. Если формат
 * дат станет сложнее (например, понадобится relative time "5 минут
 * назад") - меняется/растёт этот файл, а не компоненты, которые его
 * вызывают.
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Группировка дневника по дням/сегментам времени + месяц-сетка календаря -
// порт frontend/src/utils/dates.js (веб-версия) один в один: чистая
// дата-математика на обычном Date, никакой RN-специфики, поэтому
// переносится без изменений логики. Используется только дневником
// (src/features/diary/DiaryFeedList.tsx, DiaryCalendarView.tsx) - лента
// "Вики"/"Мои записи" (RecordsFeed.tsx) группировку по дням не показывает,
// как и на веб-версии.

const MONTH_NAMES = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

const MONTH_NAMES_NOMINATIVE = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

export const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function dayKey(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDayHeading(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const todayKey = dayKey(today.toISOString());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dayKey(yesterday.toISOString());

  if (key === todayKey) return 'Сегодня';
  if (key === yesterdayKey) return 'Вчера';
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

const TIME_SEGMENTS = [
  { label: 'Ночь', from: 0, to: 6 },
  { label: 'Утро', from: 6, to: 12 },
  { label: 'День', from: 12, to: 18 },
  { label: 'Вечер', from: 18, to: 24 },
];

export function segmentFor(isoString: string): string {
  const hour = new Date(isoString).getHours();
  return TIME_SEGMENTS.find((s) => hour >= s.from && hour < s.to)?.label || '';
}

export function groupByDay<T extends { created_at: string }>(records: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const record of records) {
    const key = dayKey(record.created_at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(record);
  }
  return [...groups.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
}

export function groupBySegment<T extends { created_at: string }>(records: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>(TIME_SEGMENTS.map((s) => [s.label, []]));
  for (const record of records) {
    groups.get(segmentFor(record.created_at))!.push(record);
  }
  return [...groups.entries()].filter(([, list]) => list.length > 0);
}

export type CalendarCell = { date: Date | null; key: string | null };

// Сетка месяца - с понедельника, дополнена пустыми ячейками до полных
// недель, чтобы сетка оставалась прямоугольной.
export function monthGrid(year: number, month: number): CalendarCell[] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlank = (firstDay.getDay() + 6) % 7; // Пн=0..Вс=6

  const cells: CalendarCell[] = [];
  for (let i = 0; i < leadingBlank; i++) cells.push({ date: null, key: null });
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    cells.push({ date, key: dayKey(date.toISOString()) });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, key: null });
  return cells;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES_NOMINATIVE[month]} ${year}`;
}
