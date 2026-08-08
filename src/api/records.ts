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

// Личный дневник - нет отдельного маршрута "только личное", веб-версия
// (frontend/src/pages/DiaryPage.jsx's PersonalFeed) тоже просто фильтрует
// /records/mine по zone на клиенте, а не заводит новый бэкенд-маршрут
// ради этого - делаем так же.
export async function fetchMyPersonalRecords(): Promise<RecordsListResponse> {
  const data = await fetchMyRecords();
  return { results: data.results.filter((r) => r.zone === 'personal') };
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

export type EditRecordPayload = {
  title?: string | null;
  body?: string | null;
  encrypted_content?: string;
  nonce?: string;
  access_level?: string | null;
};

// Правка записи - см. POST /records/<id>/edit. Бэкенд сам решает, применить
// правку сразу или отправить на согласование (см. app/records/routes.py::
// record_edit и can_edit_record там же) - владелец записи или суперадмин
// правят напрямую (получают обновлённую запись, 200), кто угодно ещё, кто
// просто видит запись - создаёт предложение (получают "pending": true, 202).
// Экран сам решает, что показать пользователю по этому признаку.
export function editRecord(
  id: number,
  payload: EditRecordPayload,
): Promise<BiographyRecord | { ok: true; pending: true; message: string }> {
  return request(`/records/${id}/edit`, { method: 'POST', body: payload });
}
