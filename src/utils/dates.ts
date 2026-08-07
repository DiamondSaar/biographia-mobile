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
