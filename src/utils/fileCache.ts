import { Directory, File, Paths } from 'expo-file-system';

/**
 * Локальный постоянный кеш вложений - файловая система сама себе индекс
 * (детерминированный путь по id вложения), отдельная база/манифест не
 * нужны. Живёт в Paths.document (не Paths.cache!) - именно ЭТО отличие
 * даёт "не потерять оригинал, даже если ОС решит почистить место" (см.
 * корневой README.md, принцип из плана про кеш вложений).
 *
 * ВАЖНО: для личной (зашифрованной) зоны здесь хранится именно
 * ШИФРТЕКСТ, тот же самый, что лежит на сервере - не расшифрованный
 * файл. Иначе "закрыть дневник" переставало бы что-либо значить для уже
 * просмотренных вложений: текст записи пропадает из памяти при
 * блокировке, а файл на диске остался бы в открытом виде навсегда.
 * Расшифровка - только на лету, в момент показа (см.
 * src/features/records/useAttachmentFile.ts), никогда не на диске.
 *
 * Новый File/Directory API (expo-file-system, SDK 54+) - синхронный
 * (не Promise), в отличие от старого FileSystem.* - см. .exists/.bytesSync()/
 * .write() ниже, await здесь не нужен и не поддерживается.
 */

export type AttachmentFileKind = 'full' | 'thumbnail' | 'preview';

const CACHE_DIR_NAME = 'biographia-attachments';

function cacheDirectory(): Directory {
  const dir = new Directory(Paths.document, CACHE_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

function cacheFile(attachmentId: number, kind: AttachmentFileKind): File {
  return new File(cacheDirectory(), `${attachmentId}-${kind}`);
}

export function isAttachmentCached(attachmentId: number, kind: AttachmentFileKind): boolean {
  return cacheFile(attachmentId, kind).exists;
}

export function readCachedAttachment(attachmentId: number, kind: AttachmentFileKind): Uint8Array {
  return cacheFile(attachmentId, kind).bytesSync();
}

export function writeCachedAttachment(attachmentId: number, kind: AttachmentFileKind, bytes: Uint8Array): void {
  cacheFile(attachmentId, kind).write(bytes);
}

/** Путь к уже закешированному файлу - вызывающий код сам проверяет isAttachmentCached() перед этим. */
export function cachedAttachmentUri(attachmentId: number, kind: AttachmentFileKind): string {
  return cacheFile(attachmentId, kind).uri;
}
