import { request } from './client';
import type { BiographyRecord, CreateRecordPayload } from './types';

/**
 * Запросы, связанные с записями биографии. Каждая функция здесь - это один
 * маршрут на бэкенде (см. app/records/routes.py в D:\projects\biographia).
 * Экраны (app/(tabs)/index.tsx и т.д.) вызывают эти функции, а не строят
 * fetch-запросы сами - если у маршрута изменится путь или параметры,
 * правится одно место здесь, а не каждый экран, который его использует.
 */

type RecordsListResponse = { results: BiographyRecord[] };

// "Вики" - общая лента последних записей (открытая зона + всё, что видно
// текущему пользователю). См. GET /records/recent.
export function fetchRecentRecords(limit = 10): Promise<RecordsListResponse> {
  return request(`/records/recent?limit=${limit}`);
}

// Личный кабинет - записи, где текущий пользователь автор или владелец.
// См. GET /records/mine.
export function fetchMyRecords(): Promise<RecordsListResponse> {
  return request('/records/mine');
}

// Одна конкретная запись целиком (с версиями) - см. GET /records/<id>.
export function fetchRecordDetail(id: number): Promise<BiographyRecord> {
  return request(`/records/${id}`);
}

// Создание новой записи - см. POST /records. Работает во всех трёх зонах
// (open/org/personal), см. CreateRecordPayload в api/types.ts - но вложения
// для личной зоны бэкенд пока не поддерживает (см. README.md проекта).
export function createRecord(payload: CreateRecordPayload): Promise<BiographyRecord> {
  return request('/records', { method: 'POST', body: payload });
}
