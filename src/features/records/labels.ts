import type { RecordType, Zone } from '@/src/api/types';

/**
 * Человеко-читаемые подписи для машинных значений с бэкенда. Ровно те же
 * подписи, что в веб-версии (frontend/src/components/RecordCard.jsx,
 * ZONE_LABELS/RECORD_TYPE_LABELS) - названия зон/типов должны звучать
 * одинаково что на сайте, что в приложении.
 */
export const ZONE_LABELS: Record<Zone, string> = {
  open: 'Открытая',
  org: 'Юрлицо',
  personal: 'Личная',
};

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  installation: 'Установка',
  documents: 'Документы',
  maintenance: 'Обслуживание',
  component_replacement: 'Замена компонента',
  relocation: 'Перемещение',
  incident: 'Инцидент',
  note: 'Свободная заметка',
  diary_entry: 'Запись в дневник',
  planned_task: 'Предстоящая работа',
};

// Список зон/типов для выпадающих списков в форме создания записи -
// объявлены здесь же, чтобы порядок пунктов в форме совпадал с порядком
// объявления подписей выше (Object.entries сохраняет порядок вставки).
export const ZONE_OPTIONS = Object.entries(ZONE_LABELS) as [Zone, string][];
export const RECORD_TYPE_OPTIONS = Object.entries(RECORD_TYPE_LABELS) as [RecordType, string][];

// "Запись в дневник" имеет смысл только в личной зоне, а "Предстоящая
// работа" - наоборот, никогда в личной зоне (оба - бэкенд их не примет в
// другой зоне, см. app/records/routes.py::create_record).
export function recordTypeOptionsForZone(zone: Zone): [RecordType, string][] {
  return RECORD_TYPE_OPTIONS.filter(([value]) => {
    if (value === 'diary_entry') return zone === 'personal';
    if (value === 'planned_task') return zone !== 'personal';
    return true;
  });
}
