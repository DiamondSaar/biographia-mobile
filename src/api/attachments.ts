import { request, requestBytes } from './client';
import type { Attachment } from './types';

/**
 * Загрузка/скачивание вложений - см. POST /records/<id>/attachments,
 * GET /attachments/<id>[/thumbnail|/preview] на бэкенде
 * (app/records/routes.py, лимит - 25 МБ, MAX_ATTACHMENT_BYTES там же).
 *
 * "Файл" для FormData в React Native выглядит не так, как в браузере: в
 * браузере это готовый объект File, здесь вместо него передаётся
 * { uri, name, type } - fetch на RN сам умеет превратить такой объект в
 * часть multipart-запроса по его uri.
 */
export type PickedFile = {
  uri: string;
  name: string;
  type: string;
};

/**
 * Open/org зона - файл уходит как есть (сервер видит настоящее имя/тип).
 * thumbnail - необязательная маленькая превьюшка, готовится на клиенте
 * ДО вызова этой функции (см. src/utils/thumbnails.ts) - сервер её
 * просто сохраняет рядом, сам не генерирует.
 */
export function uploadAttachment(recordId: number, file: PickedFile, thumbnail?: PickedFile): Promise<Attachment> {
  const formData = new FormData();
  // @ts-expect-error - React Native's FormData accepts {uri,name,type},
  // не совпадает с DOM-типом Blob/File, которого ждёт lib.dom.d.ts.
  formData.append('file', { uri: file.uri, name: file.name, type: file.type });
  if (thumbnail) {
    // @ts-expect-error - см. выше.
    formData.append('thumbnail', { uri: thumbnail.uri, name: thumbnail.name, type: thumbnail.type });
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

/** Личная (зашифрованная) зона - Phase 1c, см. корневой README.md. */
export function uploadEncryptedAttachment(recordId: number, params: UploadEncryptedAttachmentParams): Promise<Attachment> {
  const formData = new FormData();
  // @ts-expect-error - см. uploadAttachment выше.
  formData.append('file', { uri: params.file.uri, name: params.file.name, type: 'application/octet-stream' });
  if (params.thumbnail) {
    // @ts-expect-error - см. выше.
    formData.append('thumbnail', { uri: params.thumbnail.uri, name: params.thumbnail.name, type: 'application/octet-stream' });
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
