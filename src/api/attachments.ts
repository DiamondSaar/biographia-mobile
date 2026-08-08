import { request } from './client';
import type { Attachment } from './types';

/**
 * Загрузка вложений - см. POST /records/<id>/attachments на бэкенде
 * (app/records/routes.py, лимит - 25 МБ, MAX_ATTACHMENT_BYTES там же).
 * Личная (зашифрованная) зона вложения пока не поддерживает вообще -
 * сервер отвечает 501, см. корневой README.md "Осознанно отложено" -
 * эта функция вызывается только для open/org записей.
 *
 * Единственное реальное отличие от веб-версии - как выглядит "файл" для
 * FormData: в браузере это готовый объект File, в React Native вместо
 * него передаётся { uri, name, type } - fetch на RN сам умеет превратить
 * такой объект в часть multipart-запроса по его uri.
 */
export type PickedFile = {
  uri: string;
  name: string;
  type: string;
};

export function uploadAttachment(recordId: number, file: PickedFile): Promise<Attachment> {
  const formData = new FormData();
  // @ts-expect-error - React Native's FormData accepts {uri,name,type},
  // не совпадает с DOM-типом Blob/File, которого ждёт lib.dom.d.ts.
  formData.append('file', { uri: file.uri, name: file.name, type: file.type });
  return request(`/records/${recordId}/attachments`, { method: 'POST', body: formData, isFormData: true });
}
