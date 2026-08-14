import { request } from './client';

/**
 * Поиск сущностей Dominex для привязки записи - тонкий прокси к
 * GET /entities/lookup на бэкенде (app/records/routes.py:601-609), тот же
 * контракт, что уже использует веб-версия (frontend/src/components/
 * AddRecordForm.jsx's EntityPicker). Бэкенд сам ходит в Dominex - ни
 * мобильное приложение, ни браузер напрямую туда не обращаются.
 */
export type EntityResult = {
  kind: 'entity' | 'organization';
  id: number;
  display_name: string;
  template_name: string | null;
  access_class: string | null;
};

export function entityLookup(query: string, parentsOnly: boolean): Promise<{ results: EntityResult[] }> {
  const params = new URLSearchParams({ q: query, parents_only: String(parentsOnly) });
  return request(`/entities/lookup?${params.toString()}`);
}

/** Тот же /entities/lookup, но только организации - для отдельного поля "Юрлицо". */
export function organizationLookup(query: string): Promise<{ results: EntityResult[] }> {
  const params = new URLSearchParams({ q: query, kind: 'organization' });
  return request(`/entities/lookup?${params.toString()}`);
}
