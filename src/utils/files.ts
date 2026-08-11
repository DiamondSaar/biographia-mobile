// Тот же формат, что formatSize в веб-версии
// (frontend/src/components/AttachmentList.jsx) - размер файла должен
// читаться одинаково что на сайте, что в приложении.
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

// Личные вложения не отдают content_type серверу вообще (зашифрован
// вместе с именем файла, см. encryptFileMeta в src/crypto/masterKey.ts) -
// поэтому эта функция принимает MIME-тип уже РАСШИФРОВАННЫМ на стороне
// вызывающего кода, ей всё равно, personal это вложение или open/org.
export function iconForMimeType(contentType: string | null | undefined): string {
  const type = contentType || '';
  if (type.startsWith('image/')) return 'image-outline';
  if (type.startsWith('video/')) return 'videocam-outline';
  if (type === 'application/pdf') return 'document-text-outline';
  if (type.startsWith('text/')) return 'reader-outline';
  if (
    type === 'application/msword' ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    type === 'application/vnd.ms-excel' ||
    type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    type === 'application/vnd.ms-powerpoint' ||
    type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) {
    return 'document-outline';
  }
  return 'document-attach-outline';
}

// Тот же список MIME-типов, что бэкенд умеет конвертировать в PDF-превью
// (app/core/office_convert.py::CONVERTIBLE_CONTENT_TYPES) - используется
// клиентом только чтобы решить, ЕСТЬ ЛИ СМЫСЛ спрашивать /preview
// (личная зона никогда не имеет preview - сервер не видит содержимое,
// см. app/records/routes.py::download_attachment_preview).
export function isOfficeDocument(contentType: string | null | undefined): boolean {
  return (
    contentType === 'application/msword' ||
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    contentType === 'application/vnd.ms-excel' ||
    contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    contentType === 'application/vnd.ms-powerpoint' ||
    contentType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  );
}
