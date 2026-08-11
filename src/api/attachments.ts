import { Directory, File, Paths } from 'expo-file-system';

import { request, requestBytes } from './client';
import type { Attachment } from './types';

/**
 * Загрузка/скачивание вложений - см. POST /records/<id>/attachments,
 * GET /attachments/<id>[/thumbnail|/preview] на бэкенде
 * (app/records/routes.py, лимит - 25 МБ, MAX_ATTACHMENT_BYTES там же).
 *
 * ВАЖНО про части FormData: старый приём React Native -
 * `formData.append('file', {uri, name, type})` - здесь НЕ работает.
 * Global `fetch` в этом проекте (SDK 57) - это `expo`'s собственная
 * реализация (node_modules/expo/src/winter/fetch/convertFormData.ts),
 * а не встроенный в React Native fetch - она принимает только части,
 * реально совместимые с Blob (есть метод .bytes()), и явно бросает
 * "Unsupported FormDataPart implementation" на классический
 * RN-формат {uri,name,type} (найдено чтением её исходников после
 * живого теста на телефоне - ошибка воспроизводилась стабильно).
 * Поэтому каждая часть оборачивается через toNamedFile() ниже - новый
 * File API (expo-file-system) уже умеет и .bytes(), и .name/.type,
 * этого достаточно, чтобы converyFormDataAsync распознал часть
 * правильно.
 */
export type PickedFile = {
  uri: string;
  name: string;
  type: string;
};

const UPLOAD_PARTS_DIR_NAME = 'biographia-upload-parts';

function uploadPartsDirectory(): Directory {
  const dir = new Directory(Paths.cache, UPLOAD_PARTS_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * Файл с правильным именем/типом для FormData - .name/.type у File
 * определяются по РЕАЛЬНОМУ имени файла на диске, а не по тому, что
 * записано в PickedFile.name (у пикера/камеры/шифрованного временного
 * файла оно почти всегда другое - случайный кеш-путь). Поэтому байты
 * копируются в новый временный файл с нужным именем, и уже он идёт в
 * FormData - недорого (вложения ограничены 25 МБ), зато .name/.type
 * получаются автоматически верными, без риска разойтись.
 */
function toNamedFile(picked: PickedFile): File {
  const destination = new File(uploadPartsDirectory(), picked.name);
  if (destination.exists) destination.delete();
  const bytes = new File(picked.uri).bytesSync();
  destination.write(bytes);
  return destination;
}

/**
 * Open/org зона - файл уходит как есть (сервер видит настоящее имя/тип).
 * thumbnail - необязательная маленькая превьюшка, готовится на клиенте
 * ДО вызова этой функции (см. src/utils/thumbnails.ts) - сервер её
 * просто сохраняет рядом, сам не генерирует.
 */
export function uploadAttachment(recordId: number, file: PickedFile, thumbnail?: PickedFile): Promise<Attachment> {
  const formData = new FormData();
  formData.append('file', toNamedFile(file));
  if (thumbnail) {
    formData.append('thumbnail', toNamedFile(thumbnail));
  }
  return request(`/records/${recordId}/attachments`, { method: 'POST', body: formData, isFormData: true });
}

export type UploadEncryptedAttachmentParams = {
  // Уже ЗАШИФРОВАННЫЙ файл (nonce+шифртекст одним blob'ом, см.
  // packEncryptedBlob в src/crypto/masterKey.ts), записанный во временный
  // локальный файл вызывающим кодом (см.
  // src/features/records/attachmentUpload.ts) - эта функция понятия не
  // имеет о шифровании, только загружает то, что ей дали, ровно как и
  // uploadAttachment выше.
  file: PickedFile;
  thumbnail?: PickedFile;
  encryptedMeta: string;
  metaNonce: string;
};

/**
 * Личная (зашифрованная) зона - Phase 1c, см. корневой README.md.
 * Личной зоне имя/тип файла не важны вообще (сервер их даже не читает -
 * storage.put_object(..., None) на бэкенде) - можно оборачивать файл
 * как есть, без переименования, в отличие от uploadAttachment выше.
 */
export function uploadEncryptedAttachment(recordId: number, params: UploadEncryptedAttachmentParams): Promise<Attachment> {
  const formData = new FormData();
  formData.append('file', new File(params.file.uri));
  if (params.thumbnail) {
    formData.append('thumbnail', new File(params.thumbnail.uri));
  }
  formData.append('encrypted_meta', params.encryptedMeta);
  formData.append('meta_nonce', params.metaNonce);
  return request(`/records/${recordId}/attachments`, { method: 'POST', body: formData, isFormData: true });
}

/**
 * Скачивание байтов - три отдельные функции вместо одной с параметром,
 * чтобы вызывающему коду не приходилось помнить точный путь маршрута.
 * Для личной зоны результат - шифртекст (или пусто/404, если миниатюры
 * нет вообще) - расшифровка отдельным шагом, см.
 * src/features/records/useAttachmentFile.ts.
 */
export function downloadAttachmentFile(attachmentId: number): Promise<Uint8Array> {
  return requestBytes(`/attachments/${attachmentId}`);
}

export function downloadAttachmentThumbnail(attachmentId: number): Promise<Uint8Array> {
  return requestBytes(`/attachments/${attachmentId}/thumbnail`);
}

/** Только open/org зона (конвертация Office-документов) - см. app/core/office_convert.py. */
export function downloadAttachmentPreview(attachmentId: number): Promise<Uint8Array> {
  return requestBytes(`/attachments/${attachmentId}/preview`);
}
